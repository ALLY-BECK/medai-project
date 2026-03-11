from django.urls import path
from . import views

urlpatterns = [
    # Auth
    path('auth/login/',        views.login_view,         name='login'),
    path('auth/register/',     views.register_view,      name='register'),
    path('auth/verify-email/', views.verify_email_view,  name='verify-email'),
    path('auth/refresh/',      views.token_refresh_view, name='token-refresh'),
    path('auth/me/',           views.me_view,            name='me'),


    # Patients
    path('patients/',     views.PatientListView.as_view(),   name='patient-list'),
    path('patients/<int:pk>/', views.PatientDetailView.as_view(), name='patient-detail'),

    # Appointments
    path('appointments/',          views.AppointmentListCreateView.as_view(), name='appointments'),
    path('appointments/<int:pk>/', views.AppointmentDetailView.as_view(),     name='appointment-detail'),

    # Prescriptions
    path('prescriptions/',                        views.PrescriptionListCreateView.as_view(), name='prescriptions'),
    path('prescriptions/<int:pk>/dispense/',      views.dispense_prescription,                name='dispense-rx'),

    # Lab Results
    path('lab-results/',               views.LabResultListCreateView.as_view(), name='lab-results'),
    path('lab-results/<int:pk>/send/', views.send_lab_result,                   name='send-lab-result'),

    # Announcements
    path('announcements/', views.AnnouncementListCreateView.as_view(), name='announcements'),

    # Materials
    path('materials/', views.MaterialListCreateView.as_view(), name='materials'),

    # Ministry
    path('ministry/stats/', views.ministry_stats, name='ministry-stats'),

    # Patient Portal
    path('doctors/',             views.doctor_list_view,         name='doctor-list'),
    path('appointments/book/',   views.appointment_book_view,    name='appointment-book'),
    path('diagnostics/analyze/', views.diagnostics_analyze_view, name='diagnostics-analyze'),
    path('patient/me/',          views.patient_me_view,          name='patient-me'),
]
