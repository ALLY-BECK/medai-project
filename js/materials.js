// ═══════════════════════════════════════════════
// materials.js — Lectures & Articles Feature
// ═══════════════════════════════════════════════

let __materialsCache = [];

function initMaterials() {
    loadMaterials();
    
    const btn = document.getElementById('btn-add-material');
    if (btn) {
        if (AppState.role === 'admin' || AppState.role === 'ministry') {
            btn.style.display = 'inline-block';
        } else {
            btn.style.display = 'none';
        }
    }
}

async function loadMaterials() {
    try {
        const data = await apiGetMaterials();
        __materialsCache = data;
        const list = document.getElementById('materials-list');
        
        // If materials-list doesn't exist on this page/dashboard, do nothing
        if (!list) return;

        if (!data || data.length === 0) {
            list.innerHTML = '<div class="glass-card"><p>Материалы пока не добавлены.</p></div>';
            return;
        }

        list.innerHTML = data.map(mat => `
      <div class="glass-card hover-effect" style="margin-bottom: 15px; cursor: pointer; transition: all 0.2s;" onclick="openMaterial(${mat.id})">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <span class="badge ${mat.type === 'lecture' ? 'badge-blue' : 'badge-green'}" style="margin-bottom: 10px; display: inline-block;">
              ${mat.type_display}
            </span>
            <h3 style="margin-bottom: 5px; font-size: 18px;">${mat.title}</h3>
            <p style="color: rgba(255,255,255,0.6); font-size: 13px;">
              Автор: ${mat.author_name || 'Неизвестен'} • ${new Date(mat.created_at).toLocaleDateString('ru-RU')}
            </p>
          </div>
          <button class="btn btn-ghost btn-sm">Читать</button>
        </div>
      </div>
    `).join('');
    } catch (e) {
        showToast('Ошибка загрузки материалов: ' + e.message, 'error');
    }
}

// ─── Modal Actions ───

function showCreateMaterialModal() {
    document.getElementById('material-create-title').value = '';
    document.getElementById('material-create-content').value = '';
    document.getElementById('material-create-modal').style.display = 'flex';
}

function closeCreateMaterialModal() {
    document.getElementById('material-create-modal').style.display = 'none';
}

async function submitCreateMaterial() {
    const type = document.getElementById('material-create-type').value;
    const title = document.getElementById('material-create-title').value.trim();
    const content = document.getElementById('material-create-content').value.trim();

    if (!title || !content) {
        showToast('Заполните все поля', 'error');
        return;
    }

    const btn = document.getElementById('material-create-btn');
    btn.disabled = true;
    btn.innerHTML = 'Публикация...';

    try {
        await apiCreateMaterial(title, content, type);
        showToast('✅ Материал успешно опубликован!');
        closeCreateMaterialModal();
        loadMaterials();
    } catch (e) {
        showToast('Ошибка: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Опубликовать';
    }
}

function openMaterial(id) {
    const mat = __materialsCache.find(m => m.id === id);
    if (!mat) return;

    document.getElementById('material-view-title').textContent = mat.title;
    document.getElementById('material-view-meta').textContent = `${mat.type_display} • Автор: ${mat.author_name} • ${new Date(mat.created_at).toLocaleDateString('ru-RU')}`;
    document.getElementById('material-view-content').textContent = mat.content;
    document.getElementById('material-view-modal').style.display = 'flex';
}

function closeMaterialModal() {
    document.getElementById('material-view-modal').style.display = 'none';
}
