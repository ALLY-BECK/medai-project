#!/bin/bash
# ═══════════════════════════════════════════════
# start.sh — Запуск MedAI бэкенда
# Запускать из папки: med ai doc beta 2/backend/
# ═══════════════════════════════════════════════

echo "🚀 Запускаю MedAI Backend..."
echo ""

# Navigate to backend
cd "$(dirname "$0")/backend"

# Activate virtual environment
source venv/bin/activate

echo "✅ Виртуальное окружение активировано"
echo "📦 Django $(python -c 'import django; print(django.get_version())')"
echo ""
echo "🌐 Сервер запускается на: http://127.0.0.1:8000"
echo "📚 API документация:      http://127.0.0.1:8000/api/"
echo ""
echo "📧 Аккаунты:"
echo "   doctor@medai.kz   / medai2026  → Врач"
echo "   admin@medai.kz    / medai2026  → Мед персонал"
echo "   pharmacy@medai.kz / medai2026  → Аптека"
echo "   lab@medai.kz      / medai2026  → Лаборатория"
echo "   ministry@medai.kz / medai2026  → Минздрав"
echo ""
echo "💡 Для открытия фронтенда откройте index.html в браузере"
echo "   (отдельно от этого терминала)"
echo ""
echo "─────────────────────────────────────────"

python manage.py runserver 8000
