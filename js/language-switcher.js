// Универсальный языковой переключатель
document.addEventListener("DOMContentLoaded", () => {
  // === ЯЗЫКОВОЙ ПЕРЕКЛЮЧАТЕЛЬ ===
  let currentLanguage = 'RU'; // Текущий язык

  const button = document.getElementById("language-button");
  const label = document.getElementById("language-label");

  // Функция сохранения языка в localStorage
  function saveLanguage(lang) {
    localStorage.setItem('selectedLanguage', lang);
  }

  // Функция загрузки языка из localStorage
  function loadLanguage() {
    const savedLanguage = localStorage.getItem('selectedLanguage');
    return savedLanguage && ['RU', 'KZ', 'EN'].includes(savedLanguage) ? savedLanguage : 'RU';
  }

    // Функция переключения языка
  function switchLanguage() {
    // Простое переключение по кругу
    if (currentLanguage === 'RU') {
      currentLanguage = 'KZ';
    } else if (currentLanguage === 'KZ') {
      currentLanguage = 'EN';
    } else {
      currentLanguage = 'RU';
    }
    
    // Сохраняем выбранный язык
    saveLanguage(currentLanguage);
    
    // Обновляем кнопку
    label.textContent = currentLanguage;
    
    // Обновляем контент
    updatePageContent(currentLanguage);
    
    // Отправляем событие для перезагрузки документов
    window.dispatchEvent(new Event('languageChanged'));
  }

  // Функция обновления контента страницы
  function updatePageContent(lang) {
    // Находим все элементы с data-атрибутами для языков
    const elements = document.querySelectorAll('[data-ru], [data-en], [data-kz]');
    
    elements.forEach(element => {
      const langData = element.getAttribute(`data-${lang.toLowerCase()}`);
      if (langData) {
        if (element.tagName === 'UL' || element.tagName === 'OL') {
          // Для списков заменяем innerHTML
          element.innerHTML = langData;
        } else if (element.tagName === 'A') {
          // Для ссылок заменяем только textContent, сохраняя href
          element.textContent = langData;
        } else {
          // Для остальных элементов заменяем textContent или innerHTML
          if (langData.includes('<')) {
            element.innerHTML = langData;
          } else {
            element.textContent = langData;
          }
        }
      }
    });
  }

  if (button && label) {
    button.addEventListener("click", switchLanguage);
    
    // Инициализация - загружаем сохраненный язык
    currentLanguage = loadLanguage();
    label.textContent = currentLanguage;
    updatePageContent(currentLanguage);
  }
});
