from rest_framework import serializers
from .models import (
    User, Patient, ChronicDisease, Allergy, IllnessHistory,
    Appointment, Prescription, PrescriptionMed, LabResult, Announcement, Material,
    PatientDocument
)


# ─── Auth ──────────────────────────────────────────────────────────────────

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'initials', 'role', 'label', 'phone', 'iin']


class DoctorSerializer(serializers.ModelSerializer):
    # Дополнительные данные для врачей (рейтинг, опыт и т.д. можно добавить позже, пока берем базовые)
    class Meta:
        model = User
        fields = ['id', 'name', 'initials', 'label']


# ─── Patient ───────────────────────────────────────────────────────────────

class ChronicDiseaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChronicDisease
        fields = ['id', 'name']


class AllergySerializer(serializers.ModelSerializer):
    class Meta:
        model = Allergy
        fields = ['id', 'name', 'level']


class IllnessHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = IllnessHistory
        fields = ['id', 'name', 'date']


class PatientSerializer(serializers.ModelSerializer):
    chronic = serializers.SerializerMethodField()
    allergies = AllergySerializer(many=True, read_only=True)
    illnesses = IllnessHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Patient
        fields = ['id', 'iin', 'name', 'initials', 'dob', 'blood', 'gender', 'phone', 'tags', 'chronic', 'allergies', 'illnesses']

    def get_chronic(self, obj):
        return [d.name for d in obj.chronic_diseases.all()]


class PatientListSerializer(serializers.ModelSerializer):
    """Краткий сериализатор для списка пациентов"""
    class Meta:
        model = Patient
        fields = ['id', 'iin', 'name', 'initials', 'tags']


# ─── Appointment ───────────────────────────────────────────────────────────

class AppointmentSerializer(serializers.ModelSerializer):
    patient_name     = serializers.CharField(source='patient.name', read_only=True)
    patient_initials = serializers.CharField(source='patient.initials', read_only=True)
    patient_id       = serializers.IntegerField(source='patient.id', read_only=True)
    visit_type_display = serializers.CharField(source='get_visit_type_display', read_only=True)

    class Meta:
        model = Appointment
        fields = ['id', 'patient_id', 'patient_name', 'patient_initials', 'date', 'time', 'diagnosis', 'status', 'visit_type', 'visit_type_display', 'conclusion', 'post_treatment_status', 'ai_diagnostics', 'anamnesis']


class AppointmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ['patient', 'date', 'time', 'diagnosis', 'status', 'visit_type', 'conclusion', 'post_treatment_status', 'ai_diagnostics', 'anamnesis']


# ─── Prescription ──────────────────────────────────────────────────────────

class PrescriptionMedSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionMed
        fields = ['id', 'name', 'dose']


class PrescriptionSerializer(serializers.ModelSerializer):
    meds             = PrescriptionMedSerializer(many=True, read_only=True)
    patient_name     = serializers.CharField(source='patient.name', read_only=True)
    patient_iin      = serializers.CharField(source='patient.iin', read_only=True)
    doctor_name      = serializers.CharField(source='doctor.name', read_only=True)

    class Meta:
        model = Prescription
        fields = ['id', 'patient_name', 'patient_iin', 'doctor_name', 'created_at', 'valid_until', 'is_dispensed', 'meds']


class PrescriptionCreateSerializer(serializers.ModelSerializer):
    meds = PrescriptionMedSerializer(many=True)

    class Meta:
        model = Prescription
        fields = ['patient', 'valid_until', 'meds']

    def create(self, validated_data):
        meds_data = validated_data.pop('meds')
        prescription = Prescription.objects.create(**validated_data)
        for med in meds_data:
            PrescriptionMed.objects.create(prescription=prescription, **med)
        return prescription


# ─── Lab Result ────────────────────────────────────────────────────────────

class LabResultSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    patient_iin  = serializers.CharField(source='patient.iin', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = LabResult
        fields = ['id', 'patient_name', 'patient_iin', 'type', 'type_display', 'type_label', 'results', 'status', 'created_at']


class LabResultCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabResult
        fields = ['patient', 'type', 'type_label', 'results']


# ─── Announcement ──────────────────────────────────────────────────────────

class AnnouncementSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.name', read_only=True)

    class Meta:
        model = Announcement
        fields = ['id', 'author_name', 'text', 'created_at']


# ─── Material ──────────────────────────────────────────────────────────────

class MaterialSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.name', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = Material
        fields = ['id', 'author_name', 'title', 'content', 'type', 'type_display', 'created_at']


# ─── Patient Document ─────────────────────────────────────────────────────

class PatientDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True)
    patient_name     = serializers.CharField(source='patient.name', read_only=True)
    doc_type_display = serializers.CharField(source='get_doc_type_display', read_only=True)
    file_url         = serializers.SerializerMethodField()

    class Meta:
        model = PatientDocument
        fields = ['id', 'patient', 'patient_name', 'uploaded_by_name', 'doc_type', 'doc_type_display',
                  'title', 'description', 'file', 'file_url', 'doc_date', 'created_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None


