// ═══════════════════════════════════════════════
// materials.js — Lectures & Articles Feature
// ═══════════════════════════════════════════════

async function initMaterials() {
    const isAdminOrDoctor = ['admin', 'doctor', 'ministry'].includes(AppState.role);
    document.getElementById('btn-add-material').style.display = isAdminOrDoctor ? 'inline-block' : 'none';
    await loadMaterials();
}

async function loadMaterials() {
    try {
        const data = await apiFetch('/materials/');
        const list = document.getElementById('materials-list');

        if (!data || data.length === 0) {
            list.innerHTML = '<div class="glass-card"><p>Материалы пока не добавлены.</p></div>';
            return;
        }

        list.innerHTML = data.map(mat => `
      <div class="glass-card" style="margin-bottom: 15px; cursor: pointer;" onclick="openMaterial(${mat.id})">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <span class="badge ${mat.type === 'lecture' ? 'badge-blue' : 'badge-green'}" style="margin-bottom: 10px; display: inline-block;">
              ${mat.type_display}
            </span>
            <h3 style="margin-bottom: 5px; font-size: 18px;">${mat.title}</h3>
            <p style="color: var(--text-secondary); font-size: 13px;">
              Автор: ${mat.author_name || 'Неизвестен'} • ${new Date(mat.created_at).toLocaleDateString('ru-RU')}
            </p>
          </div>
          <button class="btn btn-ghost btn-sm">Читать</button>
        </div>
      </div>
    `).join('');

        // Store in memory for immediate reading without fetching again
        window.currentMaterials = data;
    } catch (e) {
        showToast('Ошибка загрузки материалов: ' + e.message, 'error');
    }
}

function showAddMaterialModal() {
    document.getElementById('mat-title').value = '';
    document.getElementById('mat-content').value = '';
    document.getElementById('add-material-modal').style.display = 'flex';
}

async function submitMaterial() {
    const type = document.getElementById('mat-type').value;
    const title = document.getElementById('mat-title').value.trim();
    const content = document.getElementById('mat-content').value.trim();

    if (!title || !content) {
        showToast('Заполните все поля', 'error');
        return;
    }

    try {
        await apiFetch('/materials/', {
            method: 'POST',
            body: JSON.stringify({ type, title, content })
        });
        showToast('Материал успешно опубликован!');
        document.getElementById('add-material-modal').style.display = 'none';
        loadMaterials();
    } catch (e) {
        showToast('Ошибка: ' + e.message, 'error');
    }
}

function openMaterial(id) {
    const mat = window.currentMaterials.find(m => m.id === id);
    if (!mat) return;

    document.getElementById('view-mat-title').textContent = mat.title;
    document.getElementById('view-mat-meta').textContent = `${mat.type_display} • Автор: ${mat.author_name} • ${new Date(mat.created_at).toLocaleDateString('ru-RU')}`;
    document.getElementById('view-mat-content').textContent = mat.content;
    document.getElementById('view-material-modal').style.display = 'flex';
}
