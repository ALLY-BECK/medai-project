from django.contrib import admin
from .models import User, Patient, ChronicDisease, Allergy, IllnessHistory, Appointment, Prescription, PrescriptionMed, LabResult, Announcement

admin.site.register(User)
admin.site.register(Patient)
admin.site.register(ChronicDisease)
admin.site.register(Allergy)
admin.site.register(IllnessHistory)
admin.site.register(Appointment)
admin.site.register(Prescription)
admin.site.register(PrescriptionMed)
admin.site.register(LabResult)
admin.site.register(Announcement)
