from django.utils import timezone
from django.core.mail import send_mail
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

import requests
from .models import (
    User, Patient, Appointment, Prescription, LabResult, Announcement, Material,
    EmailVerification, PatientDocument
)
from .serializers import (
    UserSerializer, DoctorSerializer,
    PatientSerializer, PatientListSerializer,
    AppointmentSerializer, AppointmentCreateSerializer,
    PrescriptionSerializer, PrescriptionCreateSerializer,
    LabResultSerializer, LabResultCreateSerializer,
    AnnouncementSerializer, MaterialSerializer,
    PatientDocumentSerializer,
)


# ─── Auth ──────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    POST /api/auth/login/
    Body: { "email": "..." (or iin/phone), "password": "..." }
    """
    login_id = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')

    user = None
    if login_id:
        # Try finding user by email, iin, or phone
        user = User.objects.filter(email=login_id).first()
        if not user:
            user = User.objects.filter(iin=login_id).first()
        if not user:
            user = User.objects.filter(phone=login_id).first()

    if not user or not user.check_password(password):
        return Response({'error': 'Неверные данные для входа'}, status=status.HTTP_401_UNAUTHORIZED)

    if not user.is_active:
        return Response({'error': 'Аккаунт отключён'}, status=status.HTTP_403_FORBIDDEN)

    refresh = RefreshToken.for_user(user)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    """
    POST /api/auth/register/
    """
    email    = request.data.get('email', '').strip().lower()
    phone    = request.data.get('phone', '').strip()
    iin      = request.data.get('iin', '').strip()
    password = request.data.get('password', '')
    name     = request.data.get('name', '').strip()
    role     = request.data.get('role', 'patient')

    if not password or len(password) < 6:
        return Response({'error': 'Пароль должен быть минимум 6 символов'}, status=400)
    if not name:
        return Response({'error': 'Имя обязательно'}, status=400)

    VALID_ROLES = ['doctor', 'admin', 'pharmacy', 'lab', 'ministry', 'patient']
    if role not in VALID_ROLES:
        return Response({'error': 'Неверная роль'}, status=400)

    # Check uniqueness based on provided fields
    if email and User.objects.filter(email=email).exists():
        return Response({'error': 'Пользователь с таким email уже существует'}, status=400)
    if iin and User.objects.filter(iin=iin).exists():
        return Response({'error': 'Пользователь с таким ИИН уже существует'}, status=400)
    if phone and User.objects.filter(phone=phone).exists():
        return Response({'error': 'Пользователь с таким номером телефона уже существует'}, status=400)

    ROLE_LABELS = {
        'doctor':   'Врач — Терапевт',
        'admin':    'Мед персонал',
        'pharmacy': 'Аптека',
        'lab':      'Лаборатория',
        'ministry': 'Министерство здравоохранения',
        'patient':  'Пациент',
    }

    parts = name.split()
    initials = ''.join(p[0].upper() for p in parts[:2]) if parts else name[:2].upper()

    user = User.objects.create_user(
        email=email if email else None,
        password=password,
        name=name,
        initials=initials,
        role=role,
        label=ROLE_LABELS.get(role, role),
    )
    # Activate immediately (no email verification required)
    user.is_active = True

    if iin:
        user.iin = iin
    if phone:
        user.phone = phone
    user.save()

    # If patient, create a Patient profile automatically
    if role == 'patient':
        Patient.objects.create(
            user=user,
            iin=iin or '',
            name=name,
            initials=initials,
            phone=phone or '',
            dob='',
            blood='',
            gender=''
        )

    # Issue tokens immediately so user can login right away
    refresh = RefreshToken.for_user(user)
    return Response({
        'message': 'Регистрация прошла успешно',
        'user_id': user.id,
        'email': email,
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_email_view(request):
    """
    POST /api/auth/verify-email/
    Body: { "user_id": 123, "code": "123456" }
    """
    user_id = request.data.get('user_id')
    code = str(request.data.get('code', '')).strip()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'Пользователь не найден'}, status=404)

    verification = EmailVerification.objects.filter(user=user, code=code, is_used=False).last()
    
    if not verification:
        return Response({'error': 'Неверный код или код уже использован'}, status=400)

    # Activate user
    verification.is_used = True
    verification.save()
    user.is_active = True
    user.save()

    refresh = RefreshToken.for_user(user)
    return Response({
        'message': 'Email успешно подтвержден',
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def token_refresh_view(request):
    """POST /api/auth/refresh/  — обновить access токен"""
    refresh_token = request.data.get('refresh')
    if not refresh_token:
        return Response({'error': 'refresh токен обязателен'}, status=400)
    try:
        refresh = RefreshToken(refresh_token)
        return Response({'access': str(refresh.access_token)})
    except Exception:
        return Response({'error': 'Недействительный токен'}, status=401)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """GET /api/auth/me/ — получить текущего пользователя"""
    return Response(UserSerializer(request.user).data)



# ─── Patients ──────────────────────────────────────────────────────────────

class PatientListView(generics.ListAPIView):
    """GET /api/patients/?q=...  — список пациентов с поиском"""
    serializer_class = PatientListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        q = self.request.query_params.get('q', '').strip()
        qs = Patient.objects.all()
        if q:
            qs = qs.filter(name__icontains=q) | qs.filter(iin__icontains=q)
        return qs


class PatientDetailView(generics.RetrieveAPIView):
    """GET /api/patients/{id}/ — полная карточка пациента"""
    queryset = Patient.objects.prefetch_related('chronic_diseases', 'allergies', 'illnesses')
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated]


# ─── Appointments ──────────────────────────────────────────────────────────

class AppointmentListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/appointments/?date=2026-03-04  — приёмы на дату (или на сегодня)
    POST /api/appointments/                  — создать приём
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AppointmentCreateSerializer
        return AppointmentSerializer

    def get_queryset(self):
        date_str = self.request.query_params.get('date')
        if date_str:
            return Appointment.objects.filter(date=date_str).select_related('patient')
        return Appointment.objects.filter(date=timezone.now().date()).select_related('patient')

    def perform_create(self, serializer):
        serializer.save(doctor=self.request.user)


class AppointmentDetailView(generics.RetrieveUpdateAPIView):
    """PATCH /api/appointments/{id}/ — обновить статус/заключение"""
    queryset = Appointment.objects.select_related('patient')
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]


# ─── Prescriptions ─────────────────────────────────────────────────────────

class PrescriptionListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/prescriptions/  — список рецептов (аптека видит все, врач — свои)
    POST /api/prescriptions/  — создать рецепт
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return PrescriptionCreateSerializer
        return PrescriptionSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Prescription.objects.select_related('patient', 'doctor').prefetch_related('meds')
        if user.role == 'pharmacy':
            return qs.filter(is_dispensed=False)
        if user.role == 'doctor':
            return qs.filter(doctor=user)
        return qs
    def perform_create(self, serializer):
        serializer.save(doctor=self.request.user)


# ─── Маппинг русских симптомов → EndlessMedical feature names ──────────────
SYMPTOM_MAP_RU = {
    # Общие симптомы
    'головная боль': 'Headache',
    'головокружение': 'Dizziness',
    'температура': 'Fever',
    'лихорадка': 'Fever',
    'жар': 'Fever',
    'озноб': 'Chills',
    'слабость': 'Fatigue',
    'усталость': 'Fatigue',
    'утомляемость': 'Fatigue',
    'потеря аппетита': 'AppetiteLoss',
    'потеря веса': 'WeightLoss',
    'набор веса': 'WeightGain',
    'потливость': 'Sweating',
    'ночная потливость': 'NightSweats',
    # Боль
    'боль в груди': 'ChestPain',
    'боль в животе': 'AbdominalPain',
    'боль в спине': 'BackPain',
    'боль в горле': 'SoreThroat',
    'боль в суставах': 'JointPain',
    'боль в мышцах': 'MusclePain',
    'боль в шее': 'NeckPain',
    # Дыхательная система
    'кашель': 'Cough',
    'одышка': 'ShortnessOfBreath',
    'затрудненное дыхание': 'ShortnessOfBreath',
    'насморк': 'RunnyNose',
    'заложенность носа': 'NasalCongestion',
    'чихание': 'Sneezing',
    # ЖКТ
    'тошнота': 'Nausea',
    'рвота': 'Vomiting',
    'диарея': 'Diarrhea',
    'понос': 'Diarrhea',
    'запор': 'Constipation',
    'изжога': 'Heartburn',
    'вздутие': 'Bloating',
    # Кожа
    'сыпь': 'Rash',
    'зуд': 'Itching',
    'отек': 'Swelling',
    'отёк': 'Swelling',
    # Нервная система
    'бессонница': 'Insomnia',
    'тревога': 'Anxiety',
    'депрессия': 'Depression',
    'онемение': 'Numbness',
    'судороги': 'Seizures',
    'обморок': 'Syncope',
    # Сердечно-сосудистая
    'сердцебиение': 'Palpitations',
    'учащенное сердцебиение': 'Palpitations',
    'высокое давление': 'HighBloodPressure',
    'низкое давление': 'LowBloodPressure',
    # Мочеполовая система
    'частое мочеиспускание': 'FrequentUrination',
    'болезненное мочеиспускание': 'PainfulUrination',
    # Глаза/уши
    'нарушение зрения': 'BlurredVision',
    'шум в ушах': 'Tinnitus',
    'боль в ухе': 'EarPain',
}

# ─── Локальная база знаний для диагностики ─────────────────────────────────
# Каждый диагноз содержит: набор характерных симптомов, базовую вероятность,
# и весовой множитель за каждое совпадение
DIAGNOSIS_DB = [
    {
        'name': 'ОРВИ (Острая респираторная вирусная инфекция)',
        'symptoms': {'Fever', 'Cough', 'RunnyNose', 'SoreThroat', 'Headache', 'Fatigue', 'Sneezing', 'NasalCongestion', 'Chills'},
        'base_weight': 15,
        'per_match': 12,
    },
    {
        'name': 'Грипп',
        'symptoms': {'Fever', 'Headache', 'MusclePain', 'Fatigue', 'Cough', 'Chills', 'SoreThroat', 'Sweating'},
        'base_weight': 10,
        'per_match': 13,
    },
    {
        'name': 'COVID-19',
        'symptoms': {'Fever', 'Cough', 'Fatigue', 'SoreThroat', 'Headache', 'MusclePain', 'ShortnessOfBreath', 'Diarrhea', 'Chills'},
        'base_weight': 8,
        'per_match': 11,
    },
    {
        'name': 'Аллергический ринит',
        'symptoms': {'RunnyNose', 'Sneezing', 'NasalCongestion', 'Itching', 'Headache'},
        'base_weight': 10,
        'per_match': 16,
    },
    {
        'name': 'Бронхит',
        'symptoms': {'Cough', 'Fever', 'Fatigue', 'ShortnessOfBreath', 'ChestPain', 'SoreThroat'},
        'base_weight': 8,
        'per_match': 14,
    },
    {
        'name': 'Пневмония',
        'symptoms': {'Fever', 'Cough', 'ShortnessOfBreath', 'ChestPain', 'Fatigue', 'Chills', 'Sweating'},
        'base_weight': 5,
        'per_match': 13,
    },
    {
        'name': 'Гастрит',
        'symptoms': {'AbdominalPain', 'Nausea', 'Vomiting', 'Heartburn', 'Bloating', 'AppetiteLoss'},
        'base_weight': 10,
        'per_match': 15,
    },
    {
        'name': 'Пищевое отравление',
        'symptoms': {'Nausea', 'Vomiting', 'Diarrhea', 'AbdominalPain', 'Fever', 'Fatigue'},
        'base_weight': 8,
        'per_match': 14,
    },
    {
        'name': 'Мигрень',
        'symptoms': {'Headache', 'Nausea', 'Dizziness', 'BlurredVision', 'Fatigue'},
        'base_weight': 10,
        'per_match': 16,
    },
    {
        'name': 'Гипертония (повышенное давление)',
        'symptoms': {'Headache', 'Dizziness', 'HighBloodPressure', 'BlurredVision', 'Palpitations', 'Fatigue'},
        'base_weight': 8,
        'per_match': 14,
    },
    {
        'name': 'Анемия',
        'symptoms': {'Fatigue', 'Dizziness', 'Headache', 'Palpitations', 'ShortnessOfBreath', 'LowBloodPressure'},
        'base_weight': 6,
        'per_match': 13,
    },
    {
        'name': 'Инфекция мочевыводящих путей',
        'symptoms': {'PainfulUrination', 'FrequentUrination', 'AbdominalPain', 'Fever', 'BackPain'},
        'base_weight': 8,
        'per_match': 16,
    },
    {
        'name': 'Тонзиллит (ангина)',
        'symptoms': {'SoreThroat', 'Fever', 'Headache', 'Fatigue', 'Swelling', 'Chills'},
        'base_weight': 10,
        'per_match': 14,
    },
    {
        'name': 'Остеохондроз',
        'symptoms': {'BackPain', 'NeckPain', 'Headache', 'Numbness', 'Dizziness'},
        'base_weight': 8,
        'per_match': 15,
    },
    {
        'name': 'Тревожное расстройство',
        'symptoms': {'Anxiety', 'Insomnia', 'Palpitations', 'Dizziness', 'ShortnessOfBreath', 'Sweating', 'Fatigue'},
        'base_weight': 6,
        'per_match': 12,
    },
    {
        'name': 'Отит (воспаление уха)',
        'symptoms': {'EarPain', 'Fever', 'Headache', 'Dizziness', 'Tinnitus'},
        'base_weight': 10,
        'per_match': 16,
    },
    {
        'name': 'Синдром раздражённого кишечника',
        'symptoms': {'AbdominalPain', 'Bloating', 'Diarrhea', 'Constipation', 'Nausea'},
        'base_weight': 6,
        'per_match': 14,
    },
    {
        'name': 'Дерматит',
        'symptoms': {'Rash', 'Itching', 'Swelling'},
        'base_weight': 12,
        'per_match': 20,
    },
]

# Базовый URL EndlessMedical API
ENDLESS_MEDICAL_BASE = 'https://api-prod.endlessmedical.com/v1/dx'
ENDLESS_MEDICAL_TOS = (
    'I have read, understood and I accept and agree to comply with the Terms of Use '
    'of EndlessMedicalAPI and Endless Medical services. The Terms of Use are available '
    'on endlessmedical.com'
)


def _match_symptoms(text):
    """Ищет русские симптомы в тексте и возвращает список EndlessMedical feature names."""
    text_lower = text.lower()
    matched = set()
    for ru_symptom, feature in sorted(SYMPTOM_MAP_RU.items(), key=lambda x: -len(x[0])):
        if ru_symptom in text_lower:
            matched.add(feature)
    return list(matched)


def _local_diagnose(matched_features):
    """Локальный AI-движок: оценка диагнозов на основе совпадения симптомов."""
    feature_set = set(matched_features)
    scored = []

    for diag in DIAGNOSIS_DB:
        overlap = feature_set & diag['symptoms']
        if not overlap:
            continue
        # Формула: base + per_match * совпадения, нормализованное по общему кол-ву симптомов диагноза
        coverage = len(overlap) / len(diag['symptoms'])
        raw_score = diag['base_weight'] + diag['per_match'] * len(overlap)
        # Бонус за высокое покрытие симптомов диагноза
        score = raw_score * (0.5 + 0.5 * coverage)
        probability = min(round(score), 95)  # макс 95% — это не точный диагноз
        scored.append({
            'diagnosis': diag['name'],
            'probability': probability,
            'matched_count': len(overlap),
        })

    # Сортируем по вероятности (убывание)
    scored.sort(key=lambda x: x['probability'], reverse=True)
    # Возвращаем топ-5
    return [{'diagnosis': s['diagnosis'], 'probability': s['probability']} for s in scored[:5]]


def _try_endless_medical(matched_features):
    """Попытка получить диагноз от EndlessMedical API. Возвращает (results, message) или (None, error)."""
    try:
        init_res = requests.get(f'{ENDLESS_MEDICAL_BASE}/InitSession', timeout=5, verify=False)
        init_data = init_res.json()
        if init_data.get('status') != 'ok':
            return None, f"InitSession failed: {init_data}"

        session_id = init_data['SessionID']

        tos_res = requests.post(
            f'{ENDLESS_MEDICAL_BASE}/AcceptTermsOfUse',
            params={'SessionID': session_id, 'passphrase': ENDLESS_MEDICAL_TOS},
            timeout=5, verify=False
        )
        if tos_res.json().get('status') != 'ok':
            return None, "AcceptTermsOfUse failed"

        for feature_name in matched_features:
            requests.post(
                f'{ENDLESS_MEDICAL_BASE}/UpdateFeature',
                params={'SessionID': session_id, 'name': feature_name, 'value': '1'},
                timeout=5, verify=False
            )

        analyze_res = requests.get(
            f'{ENDLESS_MEDICAL_BASE}/Analyze',
            params={'SessionID': session_id},
            timeout=10, verify=False
        )
        analyze_data = analyze_res.json()

        if analyze_data.get('status') == 'ok':
            diseases = analyze_data.get('Diseases', [])
            results = []
            for disease in diseases[:5]:
                if isinstance(disease, dict):
                    results.append({
                        'diagnosis': disease.get('name', 'Unknown'),
                        'probability': round(disease.get('probability', 0) * 100)
                    })
                elif isinstance(disease, list) and len(disease) >= 2:
                    results.append({
                        'diagnosis': str(disease[0]),
                        'probability': round(float(disease[1]) * 100)
                    })
            return results if results else None, "EndlessMedical: нет результатов"
        return None, f"Analyze error: {analyze_data}"

    except Exception:
        return None, "EndlessMedical API недоступен"


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def diagnostics_analyze_view(request):
    """
    POST /api/diagnostics/analyze/
    Body: { "symptoms": "головная боль, температура" }
    Returns: AI analysis (EndlessMedical API + локальный движок)
    """
    symptoms = request.data.get('symptoms', '')

    results = []
    source = 'none'
    message = "Рекомендуется онлайн-созвон с терапевтом для подтверждения диагноза."

    matched_features = _match_symptoms(symptoms)

    if matched_features:
        # Попытка 1: EndlessMedical API
        api_results, api_msg = _try_endless_medical(matched_features)
        if api_results:
            results = api_results
            source = 'endlessmedical'
            message = f"AI Анализ завершен (EndlessMedical API). Распознано симптомов: {len(matched_features)}."
        else:
            # Попытка 2: Локальный AI-движок
            results = _local_diagnose(matched_features)
            source = 'local_ai'
            if results:
                message = f"AI Анализ завершен (MedAI Engine). Распознано симптомов: {len(matched_features)}."
            else:
                message = "Не удалось определить диагноз по указанным симптомам."
    else:
        message = "Не удалось распознать симптомы. Попробуйте описать их подробнее (например: головная боль, температура, кашель)."

    # Последний fallback — если вообще ничего не сработало
    if not results:
        results = [
            {"diagnosis": "Необходима консультация терапевта", "probability": 100},
        ]

    return Response({
        'symptoms': symptoms,
        'matched_features': matched_features,
        'analysis': results,
        'source': source,
        'message': message
    })


# ─── Рекомендации по симптомам ──────────────────────────────────────────────
RECOMMENDATIONS_DB = {
    'Fever': ['Жаропонижающие (Парацетамол 500мг при t>38.5°C)', 'Обильное питьё', 'Постельный режим'],
    'Cough': ['Противокашлевые / муколитики', 'Рентген грудной клетки (при подозрении на пневмонию)', 'Обильное тёплое питьё'],
    'SoreThroat': ['Полоскание горла антисептиками', 'Пастилки для горла', 'Тёплое питьё'],
    'Headache': ['Анальгетики (Ибупрофен 400мг)', 'Исключить повышенное АД', 'Оценить неврологический статус'],
    'RunnyNose': ['Сосудосуживающие капли (не более 5 дней)', 'Промывание солевым раствором'],
    'NasalCongestion': ['Деконгестанты', 'Промывание носа'],
    'Fatigue': ['Общий анализ крови', 'Оценка уровня железа', 'Режим сна и отдыха'],
    'Nausea': ['Противорвотные (при необходимости)', 'Диетическое питание', 'Исключить ЖКТ патологию'],
    'Vomiting': ['Регидратация', 'Противорвотные', 'УЗИ брюшной полости'],
    'Diarrhea': ['Регидратация', 'Сорбенты', 'Копрограмма'],
    'AbdominalPain': ['УЗИ брюшной полости', 'Биохимия крови', 'Консультация хирурга (при острой боли)'],
    'ChestPain': ['ЭКГ', 'Рентген грудной клетки', 'Тропонин (исключить ОКС)'],
    'ShortnessOfBreath': ['Пульсоксиметрия', 'Рентген грудной клетки', 'Спирометрия'],
    'Dizziness': ['Измерение АД', 'ОАК', 'Консультация невролога'],
    'BackPain': ['Рентген / МРТ позвоночника', 'НПВС', 'Консультация невролога'],
    'JointPain': ['Ревматоидный фактор', 'СРБ', 'Рентген суставов'],
    'MusclePain': ['НПВС', 'Миорелаксанты', 'КФК (при выраженных болях)'],
    'Rash': ['Консультация дерматолога', 'Антигистаминные', 'Исключить аллергическую реакцию'],
    'Itching': ['Антигистаминные', 'Увлажняющие средства', 'Консультация дерматолога'],
    'Insomnia': ['Гигиена сна', 'Исключить тревожное расстройство', 'Консультация невролога'],
    'Anxiety': ['Консультация психотерапевта', 'Седативные (при необходимости)'],
    'Palpitations': ['ЭКГ', 'Холтеровское мониторирование', 'Гормоны щитовидной железы'],
    'Chills': ['Измерение температуры', 'ОАК', 'Посев крови (при подозрении на инфекцию)'],
    'Sweating': ['Гормоны щитовидной железы', 'Глюкоза крови', 'ОАК'],
    'NightSweats': ['Рентген грудной клетки', 'ОАК + СОЭ', 'Исключить туберкулёз'],
    'AppetiteLoss': ['ОАК', 'Биохимия крови', 'УЗИ брюшной полости'],
    'Swelling': ['ОАМ', 'Биохимия (креатинин, мочевина)', 'УЗИ почек'],
    'Numbness': ['Консультация невролога', 'ЭНМГ', 'МРТ (при необходимости)'],
    'HighBloodPressure': ['Суточное мониторирование АД', 'Биохимия (холестерин, глюкоза)', 'ЭКГ'],
    'FrequentUrination': ['ОАМ', 'Глюкоза крови', 'УЗИ мочевого пузыря'],
    'PainfulUrination': ['ОАМ', 'Посев мочи', 'УЗИ почек и мочевого пузыря'],
}

# Русские названия симптомов для отображения
SYMPTOM_NAMES_RU = {
    'Headache': 'Головная боль',
    'Dizziness': 'Головокружение',
    'Fever': 'Повышенная температура',
    'Chills': 'Озноб',
    'Fatigue': 'Слабость / утомляемость',
    'AppetiteLoss': 'Снижение аппетита',
    'WeightLoss': 'Потеря веса',
    'WeightGain': 'Набор веса',
    'Sweating': 'Потливость',
    'NightSweats': 'Ночная потливость',
    'ChestPain': 'Боль в груди',
    'AbdominalPain': 'Боль в животе',
    'BackPain': 'Боль в спине',
    'SoreThroat': 'Боль в горле',
    'JointPain': 'Боль в суставах',
    'MusclePain': 'Боль в мышцах',
    'NeckPain': 'Боль в шее',
    'Cough': 'Кашель',
    'ShortnessOfBreath': 'Одышка',
    'RunnyNose': 'Насморк',
    'NasalCongestion': 'Заложенность носа',
    'Sneezing': 'Чихание',
    'Nausea': 'Тошнота',
    'Vomiting': 'Рвота',
    'Diarrhea': 'Диарея',
    'Constipation': 'Запор',
    'Heartburn': 'Изжога',
    'Bloating': 'Вздутие',
    'Rash': 'Сыпь',
    'Itching': 'Зуд',
    'Swelling': 'Отёк',
    'Insomnia': 'Бессонница',
    'Anxiety': 'Тревожность',
    'Depression': 'Депрессия',
    'Numbness': 'Онемение',
    'Seizures': 'Судороги',
    'Syncope': 'Обморок',
    'Palpitations': 'Учащённое сердцебиение',
    'HighBloodPressure': 'Повышенное давление',
    'LowBloodPressure': 'Пониженное давление',
    'FrequentUrination': 'Частое мочеиспускание',
    'PainfulUrination': 'Болезненное мочеиспускание',
    'BlurredVision': 'Нарушение зрения',
    'Tinnitus': 'Шум в ушах',
    'EarPain': 'Боль в ухе',
}


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def consultation_analyze_view(request):
    """
    POST /api/consultation/analyze/
    Body: { "transcript": "...", "doctor_notes": "..." }
    Combines dialogue transcript + doctor notes, extracts symptoms,
    runs AI diagnostics, returns symptoms/diagnoses/recommendations/conclusion.
    """
    transcript = request.data.get('transcript', '')
    doctor_notes = request.data.get('doctor_notes', '')

    # Combine both text sources for analysis
    combined_text = f"{transcript}\n{doctor_notes}".strip()

    if not combined_text:
        return Response({
            'error': 'Необходимо предоставить транскрипт диалога или заметки врача'
        }, status=400)

    # 1) Extract symptoms from combined text
    matched_features = _match_symptoms(combined_text)

    # 2) Generate Russian symptom names for display
    symptoms_ru = []
    for feature in matched_features:
        ru_name = SYMPTOM_NAMES_RU.get(feature, feature)
        symptoms_ru.append(ru_name)

    # 3) Run diagnostics
    diagnoses = []
    source = 'none'

    if matched_features:
        # Try EndlessMedical API first
        api_results, api_msg = _try_endless_medical(matched_features)
        if api_results:
            diagnoses = api_results
            source = 'endlessmedical'
        else:
            # Fallback to local AI engine
            diagnoses = _local_diagnose(matched_features)
            source = 'local_ai'

    # 4) Generate recommendations based on matched symptoms
    recommendations = []
    seen_recs = set()
    for feature in matched_features:
        for rec in RECOMMENDATIONS_DB.get(feature, []):
            if rec not in seen_recs:
                recommendations.append(rec)
                seen_recs.add(rec)

    # Limit to top 10 most relevant recommendations
    recommendations = recommendations[:10]

    # 5) Generate draft conclusion
    conclusion_parts = []
    if symptoms_ru:
        conclusion_parts.append(
            f"Пациент предъявляет жалобы на: {', '.join(symptoms_ru).lower()}."
        )
    if doctor_notes.strip():
        conclusion_parts.append(f"\nДанные осмотра: {doctor_notes.strip()}")
    if diagnoses:
        top_diag = diagnoses[0]
        conclusion_parts.append(
            f"\nПредварительный диагноз: {top_diag['diagnosis']} "
            f"(вероятность {top_diag['probability']}%)."
        )
        if len(diagnoses) > 1:
            alt = ', '.join(d['diagnosis'] for d in diagnoses[1:3])
            conclusion_parts.append(f"Дифференциальный диагноз: {alt}.")
    if recommendations:
        conclusion_parts.append(f"\nНазначения: {'; '.join(recommendations[:5])}.")

    draft_conclusion = '\n'.join(conclusion_parts)

    return Response({
        'symptoms': symptoms_ru,
        'matched_features': matched_features,
        'diagnoses': diagnoses if diagnoses else [
            {'diagnosis': 'Необходима консультация терапевта', 'probability': 100}
        ],
        'recommendations': recommendations if recommendations else [
            'Рекомендуется дополнительное обследование',
            'Консультация профильного специалиста'
        ],
        'conclusion': draft_conclusion,
        'source': source,
        'transcript_length': len(transcript),
        'notes_length': len(doctor_notes),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def patient_me_view(request):
    """
    GET /api/patient/me/
    Returns full profile, history, appointments, and prescriptions of the logged in patient
    """
    try:
        patient = request.user.patient_profile
    except Exception:
        return Response({'error': 'Профиль пациента не найден'}, status=404)

    profile_data = PatientSerializer(patient).data
    appointments = AppointmentSerializer(patient.appointments.all().order_by('-date', '-time'), many=True).data
    prescriptions = PrescriptionSerializer(patient.prescriptions.all().order_by('-created_at'), many=True).data
    labs = LabResultSerializer(patient.lab_results.all().order_by('-created_at'), many=True).data

    return Response({
        'profile': profile_data,
        'appointments': appointments,
        'prescriptions': prescriptions,
        'lab_results': labs,
    })

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def dispense_prescription(request, pk):
    """PATCH /api/prescriptions/{id}/dispense/ — выдать лекарства"""
    try:
        rx = Prescription.objects.get(pk=pk)
    except Prescription.DoesNotExist:
        return Response({'error': 'Рецепт не найден'}, status=404)
    rx.is_dispensed = True
    rx.dispensed_at = timezone.now()
    rx.save()
    return Response({'status': 'dispensed', 'message': 'Лекарства выданы пациенту'})


# ─── Lab Results ───────────────────────────────────────────────────────────

class LabResultListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/lab-results/?status=pending  — анализы
    POST /api/lab-results/                 — добавить результат
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return LabResultCreateSerializer
        return LabResultSerializer

    def get_queryset(self):
        status_filter = self.request.query_params.get('status')
        qs = LabResult.objects.select_related('patient', 'lab_user')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        serializer.save(lab_user=self.request.user, status='pending')


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def send_lab_result(request, pk):
    """PATCH /api/lab-results/{id}/send/ — отправить результат пациенту"""
    try:
        result = LabResult.objects.get(pk=pk)
    except LabResult.DoesNotExist:
        return Response({'error': 'Результат не найден'}, status=404)
    result.status = 'sent'
    result.sent_at = timezone.now()
    result.save()
    return Response({'status': 'sent', 'message': f'Результат отправлен {result.patient.name}'})


# ─── Announcements ─────────────────────────────────────────────────────────

class AnnouncementListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/announcements/  — список объявлений
    POST /api/announcements/  — создать объявление (admin)
    """
    queryset = Announcement.objects.select_related('author')
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


# ─── Materials ─────────────────────────────────────────────────────────────

class MaterialListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/materials/  — список лекций и статей
    POST /api/materials/  — добавить материал (врач/админ)
    """
    queryset = Material.objects.select_related('author')
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


# ─── Ministry Stats ────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ministry_stats(request):
    """GET /api/ministry/stats/ — статистика для Минздрава"""
    return Response({
        'clinics': 247,
        'doctors': User.objects.filter(role='doctor').count(),
        'patients': Patient.objects.count(),
        'appointments_month': Appointment.objects.count(),
        'complaints': 12,
        'regions': [
            {'name': 'Алматы',     'visits': 5420, 'doctors': 1240, 'clinics': 68},
            {'name': 'Астана',     'visits': 4180, 'doctors': 980,  'clinics': 52},
            {'name': 'Шымкент',    'visits': 2610, 'doctors': 620,  'clinics': 34},
            {'name': 'Қарағанды', 'visits': 1840, 'doctors': 440,  'clinics': 28},
            {'name': 'Атырау',     'visits': 1230, 'doctors': 290,  'clinics': 18},
            {'name': 'Өскемен',   'visits': 980,  'doctors': 210,  'clinics': 15},
        ]
    })


# ─── Patient Portal ────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def doctor_list_view(request):
    """ GET /api/doctors/ - Список врачей для записи """
    doctors = User.objects.filter(role='doctor', is_active=True)
    return Response(DoctorSerializer(doctors, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def appointment_book_view(request):
    """
    POST /api/appointments/book/
    Body: { "doctor_id": 1, "date": "2024-05-10", "time": "10:30" }
    """
    try:
        patient = request.user.patient_profile
    except Exception:
        return Response({'error': 'Только пациенты могут записываться'}, status=403)

    doctor_id = request.data.get('doctor_id')
    date = request.data.get('date')
    time = request.data.get('time')
    anamnesis = request.data.get('anamnesis', '')

    if not all([doctor_id, date, time]):
        return Response({'error': 'Обязательные поля: doctor_id, date, time'}, status=400)

    try:
        doctor = User.objects.get(id=doctor_id, role='doctor')
    except User.DoesNotExist:
        return Response({'error': 'Врач не найден'}, status=404)

    app = Appointment.objects.create(
        doctor=doctor,
        patient=patient,
        date=date,
        time=time,
        anamnesis=anamnesis,
        status='waiting'
    )
    return Response(AppointmentSerializer(app).data, status=status.HTTP_201_CREATED)


# ─── Patient Documents ────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def patient_documents_view(request):
    """
    GET  /api/patient-documents/?patient_id=X  — list documents for patient
    POST /api/patient-documents/               — upload a document (multipart/form-data)
    """
    if request.method == 'GET':
        patient_id = request.query_params.get('patient_id')
        if patient_id:
            docs = PatientDocument.objects.filter(patient_id=patient_id)
        else:
            docs = PatientDocument.objects.all()
        serializer = PatientDocumentSerializer(docs, many=True, context={'request': request})
        return Response(serializer.data)

    elif request.method == 'POST':
        patient_id = request.data.get('patient')
        if not patient_id:
            return Response({'error': 'Укажите ID пациента'}, status=400)

        try:
            patient = Patient.objects.get(id=patient_id)
        except Patient.DoesNotExist:
            return Response({'error': 'Пациент не найден'}, status=404)

        doc = PatientDocument(
            patient=patient,
            uploaded_by=request.user,
            doc_type=request.data.get('doc_type', 'analysis'),
            title=request.data.get('title', 'Без названия'),
            description=request.data.get('description', ''),
            doc_date=request.data.get('doc_date') or None,
        )

        if 'file' in request.FILES:
            doc.file = request.FILES['file']
        else:
            return Response({'error': 'Файл не прикреплён'}, status=400)

        doc.save()
        serializer = PatientDocumentSerializer(doc, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def patient_document_delete_view(request, pk):
    """DELETE /api/patient-documents/<pk>/"""
    try:
        doc = PatientDocument.objects.get(id=pk)
    except PatientDocument.DoesNotExist:
        return Response({'error': 'Документ не найден'}, status=404)

    doc.file.delete(save=False)
    doc.delete()
    return Response({'ok': True}, status=204)
