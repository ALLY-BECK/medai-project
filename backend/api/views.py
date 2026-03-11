from django.utils import timezone
from django.core.mail import send_mail
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

import random
from .models import (
    User, Patient, Appointment, Prescription, LabResult, Announcement, Material, EmailVerification
)
from .serializers import (
    UserSerializer, DoctorSerializer,
    PatientSerializer, PatientListSerializer,
    AppointmentSerializer, AppointmentCreateSerializer,
    PrescriptionSerializer, PrescriptionCreateSerializer,
    LabResultSerializer, LabResultCreateSerializer,
    AnnouncementSerializer, MaterialSerializer,
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
    # Deactivate until email is verified
    user.is_active = False
    
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

    # Generate 6-digit code
    code = f"{random.randint(100000, 999999)}"
    EmailVerification.objects.create(user=user, code=code)

    # Send verification email if email is provided
    if email:
        send_mail(
            subject='Код подтверждения MedAI',
            message=f'Здравствуйте, {name}!\n\nВаш код для завершения регистрации: {code}\nНикому не сообщайте этот код.\n\nС уважением,\nКоманда MedAI',
            from_email='noreply@medai.kz',
            recipient_list=[email],
            fail_silently=True,
        )

    return Response({
        'message': 'Код подтверждения отправлен на почту',
        'user_id': user.id,
        'email': email
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def diagnostics_analyze_view(request):
    """
    POST /api/diagnostics/analyze/
    Body: { "symptoms": "головная боль, температура" }
    Returns: AI analysis mockup
    """
    symptoms = request.data.get('symptoms', '')
    
    # Simple mockup for the frontend to render AI triage
    results = [
        {"diagnosis": "ОРВИ (Острая респираторная вирусная инфекция)", "probability": 85},
        {"diagnosis": "Грипп", "probability": 45},
        {"diagnosis": "Аллергическая реакция", "probability": 15}
    ]
    
    return Response({
        'symptoms': symptoms,
        'analysis': results,
        'message': 'Рекомендуется онлайн-созвон с терапевтом для подтверждения диагноза.'
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
        status='waiting'
    )
    return Response(AppointmentSerializer(app).data, status=status.HTTP_201_CREATED)
