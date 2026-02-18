// Админ-панель данных футера
class FooterAdmin {
    constructor() {
        this.footerData = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupLanguageTabs();
        
        // Ждём инициализации Supabase
        if (typeof window.supabase === 'undefined' || !window.supabase) {
            console.log('Ожидание инициализации Supabase...');
            await this.waitForSupabase(3000);
        }
        
        // Загружаем данные футера
        await this.loadFooterData();
        this.populateForm();
    }

    setupEventListeners() {
        // Форма редактирования
        const footerForm = document.getElementById('footerForm');
        if (footerForm) {
            footerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit(e);
            });
        }

        // Кнопка сброса
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.populateForm();
            });
        }
    }

    setupLanguageTabs() {
        const langTabs = document.querySelectorAll('.lang-tab');
        langTabs.forEach(tab => {
            // Удаляем старые обработчики если есть
            const newTab = tab.cloneNode(true);
            tab.parentNode.replaceChild(newTab, tab);
            
            newTab.addEventListener('click', () => {
                const lang = newTab.getAttribute('data-lang');
                
                // Находим родительский контейнер
                const multilangSection = newTab.closest('.multilang-section');
                if (!multilangSection) return;
                
                // Убираем активный класс
                multilangSection.querySelectorAll('.lang-tab').forEach(t => t.classList.remove('active'));
                multilangSection.querySelectorAll('.lang-panel').forEach(p => p.classList.remove('active'));
                
                // Добавляем активный класс
                newTab.classList.add('active');
                const panel = multilangSection.querySelector(`.lang-panel[data-lang="${lang}"]`);
                if (panel) {
                    panel.classList.add('active');
                }
            });
        });
    }

    async waitForSupabase(maxWait = 5000) {
        const startTime = Date.now();
        while (typeof window.supabase === 'undefined' || !window.supabase) {
            if (Date.now() - startTime > maxWait) {
                throw new Error('Supabase не инициализирован в течение ' + maxWait + 'мс');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async loadFooterData() {
        try {
            if (typeof window.supabase === 'undefined' || !window.supabase) {
                await this.waitForSupabase(5000);
            }

            if (typeof window.supabase === 'undefined' || !window.supabase) {
                throw new Error('Supabase не инициализирован');
            }

            // Загружаем данные футера (берем последнюю запись)
            const { data, error } = await window.supabase
                .from('footer_data')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                throw error;
            }

            this.footerData = data;
            console.log('Загруженные данные футера:', this.footerData);
        } catch (error) {
            console.error('Ошибка загрузки данных футера:', error);
            this.showNotification('Ошибка загрузки данных футера: ' + error.message, 'error');
        }
    }

    populateForm() {
        if (!this.footerData) {
            console.warn('Нет данных футера для заполнения формы.');
            return;
        }

        document.getElementById('address_ru').value = this.footerData.address_ru || '';
        document.getElementById('address_en').value = this.footerData.address_en || '';
        document.getElementById('address_kz').value = this.footerData.address_kz || '';
        document.getElementById('phone').value = this.footerData.phone || '';
        document.getElementById('email').value = this.footerData.email || '';
        document.getElementById('working_hours_ru').value = this.footerData.working_hours_ru || '';
        document.getElementById('working_hours_en').value = this.footerData.working_hours_en || '';
        document.getElementById('working_hours_kz').value = this.footerData.working_hours_kz || '';
        document.getElementById('lunch_break_ru').value = this.footerData.lunch_break_ru || '';
        document.getElementById('lunch_break_en').value = this.footerData.lunch_break_en || '';
        document.getElementById('lunch_break_kz').value = this.footerData.lunch_break_kz || '';

        // Активируем русскую вкладку по умолчанию
        const ruTab = document.querySelector('#footerForm .lang-tab[data-lang="ru"]');
        if (ruTab) {
            ruTab.click();
        }
    }

    async handleSubmit(e) {
        const form = e.target;
        const formData = new FormData(form);

        try {
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
            submitBtn.disabled = true;

            const updateData = {
                address_ru: formData.get('address_ru'),
                address_en: formData.get('address_en') || null,
                address_kz: formData.get('address_kz') || null,
                phone: formData.get('phone'),
                email: formData.get('email'),
                working_hours_ru: formData.get('working_hours_ru'),
                working_hours_en: formData.get('working_hours_en') || null,
                working_hours_kz: formData.get('working_hours_kz') || null,
                lunch_break_ru: formData.get('lunch_break_ru') || null,
                lunch_break_en: formData.get('lunch_break_en') || null,
                lunch_break_kz: formData.get('lunch_break_kz') || null
            };

            console.log('Обновляем данные футера в Supabase:', updateData);

            let result;
            if (this.footerData && this.footerData.id) {
                // Обновляем существующую запись
                result = await window.supabase
                    .from('footer_data')
                    .update(updateData)
                    .eq('id', this.footerData.id);
            } else {
                // Создаем новую запись
                result = await window.supabase
                    .from('footer_data')
                    .insert([updateData]);
            }

            if (result.error) {
                throw result.error;
            }

            console.log('Данные футера успешно обновлены в Supabase:', result.data);
            this.showNotification('Данные футера успешно обновлены!', 'success');
            await this.loadFooterData(); // Перезагружаем данные для обновления формы

            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        } catch (error) {
            console.error('Ошибка сохранения данных футера:', error);
            this.showNotification('Ошибка при сохранении данных футера: ' + error.message, 'error');
            
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить изменения';
            submitBtn.disabled = false;
        }
    }

    showNotification(message, type = 'info') {
        // Создаем контейнер для уведомлений, если его нет
        let notificationContainer = document.getElementById('notificationContainer');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notificationContainer';
            notificationContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000;';
            document.body.appendChild(notificationContainer);
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 300px;
        `;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button class="close-notification" style="margin-left: auto; background: none; border: none; color: white; cursor: pointer; padding: 0; width: 20px; height: 20px;">
                <i class="fas fa-times"></i>
            </button>
        `;
        notificationContainer.appendChild(notification);

        // Автоматическое закрытие
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => notification.remove(), 300);
        }, 5000);

        // Закрытие по клику
        notification.querySelector('.close-notification').addEventListener('click', () => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => notification.remove(), 300);
        });
    }
}

// Инициализация админки после загрузки DOM
document.addEventListener('DOMContentLoaded', async () => {
    // Проверка авторизации
    await window.ABU_ADMIN_AUTH?.guardAdminPage();
    window.footerAdmin = new FooterAdmin();
});

