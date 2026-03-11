"""
Management command: seed the database with test data
Usage: python manage.py seed_data
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, time, timedelta
from api.models import (
    User, Patient, ChronicDisease, Allergy, IllnessHistory,
    Appointment, Prescription, PrescriptionMed, LabResult, Announcement
)


class Command(BaseCommand):
    help = 'Заполняет базу данных тестовыми данными MedAI'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('🔄 Очищаю старые данные...'))
        User.objects.all().delete()
        Patient.objects.all().delete()
        Announcement.objects.all().delete()

        # ── Users ──────────────────────────────────────────────────────────
        self.stdout.write('👤 Создаю пользователей...')
        users = {}
        user_data = [
            dict(email='doctor@medai.kz',   name='Доктор Асель Нурланова',  initials='АН', role='doctor',   label='Врач — Терапевт'),
            dict(email='admin@medai.kz',    name='Администратор Клиники',    initials='АК', role='admin',    label='Мед персонал'),
            dict(email='pharmacy@medai.kz', name='Аптекарь Данияр',          initials='ДА', role='pharmacy', label='Аптека №3'),
            dict(email='lab@medai.kz',      name='Лаборант Айгерим',         initials='АЛ', role='lab',      label='Лаборатория'),
            dict(email='ministry@medai.kz', name='Инспектор Минздрав',       initials='МЗ', role='ministry', label='Министерство здравоохранения'),
        ]
        for ud in user_data:
            u = User.objects.create_user(password='medai2026', **ud)
            users[ud['role']] = u
            self.stdout.write(f'   ✅ {ud["email"]}')

        # ── Patients ───────────────────────────────────────────────────────
        self.stdout.write('🏥 Создаю пациентов...')
        patients_raw = [
            {
                'iin': '9203154521', 'name': 'Айгерим Сейткали', 'initials': 'АС',
                'dob': '15.03.1992', 'blood': 'A(II) Rh+', 'gender': 'Женский',
                'phone': '+7 701 234 5678', 'tags': ['Гастрит', 'Анемия'],
                'chronic': ['Хронический гастрит', 'Анемия лёгкой степени'],
                'allergies': [('Пенициллин', 'high'), ('Пыльца берёзы', 'med')],
                'illnesses': [('ОРВИ', 'Январь 2026'), ('Острый бронхит', 'Март 2025'), ('Гастрит обострение', 'Октябрь 2024')],
            },
            {
                'iin': '8501234567', 'name': 'Болат Жаксыбеков', 'initials': 'БЖ',
                'dob': '12.01.1985', 'blood': 'O(I) Rh+', 'gender': 'Мужской',
                'phone': '+7 702 345 6789', 'tags': ['Гипертония', 'Ожирение'],
                'chronic': ['Гипертония II степени', 'Ожирение I степени'],
                'allergies': [('Аспирин', 'high')],
                'illnesses': [('Гипертонический криз', 'Декабрь 2025'), ('ОРВИ', 'Сентябрь 2025')],
            },
            {
                'iin': '9507281234', 'name': 'Дина Мухамедова', 'initials': 'ДМ',
                'dob': '28.07.1995', 'blood': 'B(III) Rh-', 'gender': 'Женский',
                'phone': '+7 707 456 7890', 'tags': ['Диабет'],
                'chronic': ['Сахарный диабет 2 типа'],
                'allergies': [('Мёд', 'low'), ('Орехи', 'med')],
                'illnesses': [('Диабетическая нейропатия', 'Ноябрь 2025'), ('ОРВИ', 'Август 2025')],
            },
            {
                'iin': '8812034521', 'name': 'Ерлан Касымов', 'initials': 'ЕК',
                'dob': '03.12.1988', 'blood': 'AB(IV) Rh+', 'gender': 'Мужской',
                'phone': '+7 705 567 8901', 'tags': ['Остеохондроз'],
                'chronic': ['Остеохондроз поясничного отдела'],
                'allergies': [],
                'illnesses': [('Радикулит', 'Февраль 2026'), ('Растяжение мышц спины', 'Июль 2025')],
            },
            {
                'iin': '0004152345', 'name': 'Жанар Бекова', 'initials': 'ЖБ',
                'dob': '15.04.2000', 'blood': 'A(II) Rh-', 'gender': 'Женский',
                'phone': '+7 708 678 9012', 'tags': ['Аллергия', 'Дерматит'],
                'chronic': ['Аллергический ринит', 'Атопический дерматит'],
                'allergies': [('Кошачья шерсть', 'high'), ('Пыльца', 'high'), ('Цитрусовые', 'med')],
                'illnesses': [('Аллергический ринит обострение', 'Февраль 2026'), ('Крапивница', 'Май 2025')],
            },
            {
                'iin': '9309234512', 'name': 'Зарина Алиева', 'initials': 'ЗА',
                'dob': '23.09.1993', 'blood': 'O(I) Rh+', 'gender': 'Женский',
                'phone': '+7 701 789 0123', 'tags': ['Здоров'],
                'chronic': [],
                'allergies': [('Латекс', 'med')],
                'illnesses': [('Плановый осмотр', 'Февраль 2026'), ('ОРВИ', 'Декабрь 2025')],
            },
            {
                'iin': '7806124523', 'name': 'Нурлан Сейткали', 'initials': 'НС',
                'dob': '12.06.1978', 'blood': 'B(III) Rh+', 'gender': 'Мужской',
                'phone': '+7 702 890 1234', 'tags': ['Бронхит', 'Гипертония'],
                'chronic': ['Хронический бронхит', 'Гипертония I степени'],
                'allergies': [('Сульфаниламиды', 'high')],
                'illnesses': [('Обострение бронхита', 'Февраль 2026'), ('Пневмония', 'Январь 2025')],
            },
            {
                'iin': '9112034521', 'name': 'Мадина Ержанова', 'initials': 'МЕ',
                'dob': '03.12.1991', 'blood': 'A(II) Rh+', 'gender': 'Женский',
                'phone': '+7 707 901 2345', 'tags': ['Мигрень', 'ВСД'],
                'chronic': ['Мигрень', 'Вегетососудистая дистония'],
                'allergies': [('Кодеин', 'high')],
                'illnesses': [('Мигрень с аурой', 'Февраль 2026'), ('Гипертонический криз', 'Октябрь 2025')],
            },
            {
                'iin': '9708234512', 'name': 'Асель Нурмагамбетова', 'initials': 'АН',
                'dob': '23.08.1997', 'blood': 'O(I) Rh-', 'gender': 'Женский',
                'phone': '+7 705 012 3456', 'tags': ['Анемия'],
                'chronic': ['Железодефицитная анемия'],
                'allergies': [],
                'illnesses': [('Анемия тяжёлой степени', 'Январь 2026')],
            },
            {
                'iin': '0106154523', 'name': 'Тимур Абенов', 'initials': 'ТА',
                'dob': '15.06.2001', 'blood': 'AB(IV) Rh+', 'gender': 'Мужской',
                'phone': '+7 708 123 4567', 'tags': ['Здоров'],
                'chronic': [],
                'allergies': [('Ибупрофен', 'low')],
                'illnesses': [('Перелом лучевой кости', 'Ноябрь 2025'), ('ОРВИ', 'Сентябрь 2025')],
            },
        ]

        patients = []
        for pr in patients_raw:
            p = Patient.objects.create(
                iin=pr['iin'], name=pr['name'], initials=pr['initials'],
                dob=pr['dob'], blood=pr['blood'], gender=pr['gender'],
                phone=pr['phone'], tags=pr['tags'],
            )
            for c in pr['chronic']:
                ChronicDisease.objects.create(patient=p, name=c)
            for (aname, alevel) in pr['allergies']:
                Allergy.objects.create(patient=p, name=aname, level=alevel)
            for (iname, idate) in pr['illnesses']:
                IllnessHistory.objects.create(patient=p, name=iname, date=idate)
            patients.append(p)
            self.stdout.write(f'   ✅ {p.name}')

        # ── Appointments ───────────────────────────────────────────────────
        self.stdout.write('📋 Создаю приёмы на сегодня...')
        today = date.today()
        doctor = users['doctor']
        appointment_times = [
            (time(9, 0),  patients[0], 'ОРВИ, возможный грипп',           'done'),
            (time(9, 30), patients[1], 'Гипертония II степени',            'done'),
            (time(10, 0), patients[2], 'Сахарный диабет, контроль',        'done'),
            (time(10, 30),patients[3], 'Боли в пояснице, радикулит',       'current'),
            (time(11, 0), patients[4], 'Аллергический ринит',              'waiting'),
            (time(11, 30),patients[5], 'Плановый осмотр',                  'waiting'),
            (time(14, 0), patients[6], 'Бронхит, кашель 2 недели',         'waiting'),
            (time(14, 30),patients[7], 'Мигрень, головные боли',           'waiting'),
        ]
        for (t, p, diag, st) in appointment_times:
            Appointment.objects.create(doctor=doctor, patient=p, date=today, time=t, diagnosis=diag, status=st)

        # ── Prescription ───────────────────────────────────────────────────
        self.stdout.write('💊 Создаю рецепты...')
        rx = Prescription.objects.create(
            doctor=doctor, patient=patients[3],
            valid_until=today + timedelta(days=7),
        )
        PrescriptionMed.objects.create(prescription=rx, name='Ибупрофен 400мг',       dose='1 таб. 3 раза в день, 7 дней')
        PrescriptionMed.objects.create(prescription=rx, name='Мидокалм 150мг',         dose='1 таб. 2 раза в день, 10 дней')
        PrescriptionMed.objects.create(prescription=rx, name='Диклофенак гель 1%',     dose='Наружно 2-3 раза в день')

        # ── Lab Results ────────────────────────────────────────────────────
        self.stdout.write('🔬 Создаю лаб анализы...')
        lab_user = users['lab']
        lab_data = [
            (patients[4], 'blood',    'Общий анализ крови',             'pending'),
            (patients[1], 'biochem',  'Биохимия крови',                 'pending'),
            (patients[6], 'pcr',      'ПЦР тест',                      'pending'),
            (patients[2], 'urine',    'Общий анализ мочи',              'pending'),
            (patients[7], 'hormones', 'Гормоны щитовидной железы',     'pending'),
            (patients[0], 'blood',    'Общий анализ крови',             'sent'),
            (patients[3], 'biochem',  'Биохимия крови',                 'sent'),
            (patients[5], 'pcr',      'ПЦР тест',                      'sent'),
        ]
        for (p, ltype, label, st) in lab_data:
            LabResult.objects.create(patient=p, lab_user=lab_user, type=ltype, type_label=label, status=st)

        # ── Announcements ──────────────────────────────────────────────────
        self.stdout.write('📢 Создаю объявления...')
        admin_user = users['admin']
        Announcement.objects.create(author=admin_user, text='Плановое техническое обслуживание МРТ-аппарата 20 марта с 08:00 до 14:00. Запись на МРТ временно недоступна.')
        Announcement.objects.create(author=admin_user, text='Новый протокол выдачи рецептов вступает в силу с 1 апреля 2026. Ознакомьтесь с инструкцией в отделе.')
        Announcement.objects.create(author=admin_user, text='Корпоративный медосмотр для сотрудников клиники — 15 марта 2026.')

        self.stdout.write(self.style.SUCCESS('\n✅ База данных успешно заполнена!'))
        self.stdout.write(self.style.SUCCESS('\n📧 Аккаунты для входа:'))
        self.stdout.write('   doctor@medai.kz   / medai2026  → Врач')
        self.stdout.write('   admin@medai.kz    / medai2026  → Мед персонал')
        self.stdout.write('   pharmacy@medai.kz / medai2026  → Аптека')
        self.stdout.write('   lab@medai.kz      / medai2026  → Лаборатория')
        self.stdout.write('   ministry@medai.kz / medai2026  → Минздрав')
