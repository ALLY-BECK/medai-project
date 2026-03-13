from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin


# ─── User ──────────────────────────────────────────────────────────────────

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email обязателен')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('doctor',   'Врач'),
        ('admin',    'Мед персонал'),
        ('pharmacy', 'Аптекарь'),
        ('lab',      'Лаборатория'),
        ('ministry', 'Минздрав'),
        ('patient',  'Пациент'),
    ]

    email    = models.EmailField(unique=True, null=True, blank=True)
    phone    = models.CharField(max_length=30, unique=True, null=True, blank=True)
    iin      = models.CharField(max_length=12, unique=True, null=True, blank=True)
    
    name     = models.CharField(max_length=120)
    initials = models.CharField(max_length=5)
    role     = models.CharField(max_length=20, choices=ROLE_CHOICES, default='doctor')
    label    = models.CharField(max_length=100, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff  = models.BooleanField(default=False)

    objects = UserManager()

    # Для входа можно использовать email, phone или iin. 
    # USERNAME_FIELD django требует уникальным, оставим email как base, 
    # а логика авторизации будет кастомной в views.py
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name', 'role']

    def __str__(self):
        return f'{self.name} ({self.role})'


class EmailVerification(models.Model):
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verifications')
    code       = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used    = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.email} - {self.code}"


# ─── Patient ───────────────────────────────────────────────────────────────

class Patient(models.Model):
    user     = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient_profile', null=True, blank=True)
    iin      = models.CharField(max_length=12, unique=True)
    name     = models.CharField(max_length=120)
    initials = models.CharField(max_length=5)
    dob      = models.CharField(max_length=20)
    blood    = models.CharField(max_length=20)
    gender   = models.CharField(max_length=20)
    phone    = models.CharField(max_length=30)
    marital_status = models.CharField(max_length=50, blank=True, default='Не указано')
    tags     = models.JSONField(default=list)

    def __str__(self):
        return f'{self.name} ({self.iin})'


class ChronicDisease(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='chronic_diseases')
    name    = models.CharField(max_length=200)

    def __str__(self):
        return self.name


class Allergy(models.Model):
    LEVEL_CHOICES = [('high', 'Высокая'), ('med', 'Средняя'), ('low', 'Низкая')]
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='allergies')
    name    = models.CharField(max_length=100)
    level   = models.CharField(max_length=10, choices=LEVEL_CHOICES)

    def __str__(self):
        return f'{self.name} — {self.level}'


class IllnessHistory(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='illnesses')
    name    = models.CharField(max_length=200)
    date    = models.CharField(max_length=50)

    def __str__(self):
        return self.name


# ─── Appointment ───────────────────────────────────────────────────────────

class Appointment(models.Model):
    STATUS_CHOICES = [
        ('waiting', 'Ожидает'),
        ('current', 'Идёт приём'),
        ('done',    'Завершён'),
    ]
    doctor    = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='appointments')
    patient   = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='appointments')
    date      = models.DateField()
    time      = models.TimeField()
    diagnosis = models.TextField(blank=True)
    status    = models.CharField(max_length=10, choices=STATUS_CHOICES, default='waiting')
    conclusion = models.TextField(blank=True)
    post_treatment_status = models.TextField(blank=True, help_text="Состояние после лечения")
    ai_diagnostics = models.TextField(blank=True, help_text="JSON строка или текст ИИ-заключения")
    anamnesis = models.TextField(blank=True, help_text="Предварительный анамнез от пациента (жалобы)")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'time']

    def __str__(self):
        return f'{self.patient.name} — {self.date} {self.time}'


# ─── Prescription ──────────────────────────────────────────────────────────

class Prescription(models.Model):
    doctor       = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='prescriptions')
    patient      = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='prescriptions')
    created_at   = models.DateTimeField(auto_now_add=True)
    valid_until  = models.DateField()
    is_dispensed = models.BooleanField(default=False)
    dispensed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'Рецепт {self.patient.name} от {self.created_at.date()}'


class PrescriptionMed(models.Model):
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name='meds')
    name         = models.CharField(max_length=200)
    dose         = models.CharField(max_length=200)

    def __str__(self):
        return self.name


# ─── Lab Result ────────────────────────────────────────────────────────────

class LabResult(models.Model):
    STATUS_CHOICES = [('pending', 'Ожидает'), ('sent', 'Отправлен')]
    TYPE_CHOICES = [
        ('blood',    'Общий анализ крови'),
        ('biochem',  'Биохимия крови'),
        ('urine',    'Общий анализ мочи'),
        ('pcr',      'ПЦР тест'),
        ('hormones', 'Гормоны щитовидной железы'),
    ]
    patient    = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='lab_results')
    lab_user   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='lab_results')
    type       = models.CharField(max_length=20, choices=TYPE_CHOICES, default='blood')
    type_label = models.CharField(max_length=100, blank=True)
    results    = models.TextField(blank=True)
    status     = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_type_display()} — {self.patient.name}'


# ─── Announcement ──────────────────────────────────────────────────────────

class Announcement(models.Model):
    author     = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    text       = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.text[:60]

# ─── Material (Lectures & Articles) ────────────────────────────────────────

class Material(models.Model):
    TYPE_CHOICES = [
        ('article', 'Статья'),
        ('lecture', 'Лекция'),
    ]
    author     = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='materials')
    title      = models.CharField(max_length=255)
    content    = models.TextField()
    type       = models.CharField(max_length=20, choices=TYPE_CHOICES, default='article')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_type_display()}: {self.title}'

