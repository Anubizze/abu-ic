document.addEventListener("DOMContentLoaded", () => {
  // === ЯЗЫКОВОЙ ПЕРЕКЛЮЧАТЕЛЬ ===
  const languages = ["KZ", "RU", "EN"];
  let currentIndex = 0;

  const button = document.getElementById("language-button");
  const label = document.getElementById("language-label");

  if (button && label) {
    button.addEventListener("click", () => {
      currentIndex = (currentIndex + 1) % languages.length;
      label.textContent = languages[currentIndex];
    });
  }

  // === СЛАЙДЕР НОВОСТЕЙ ===
  const slider = document.querySelector(".news__slider-wrapper");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  if (slider && prevBtn && nextBtn) {
    const slideStep = 446 + 24; // ширина карточки + gap

    nextBtn.addEventListener("click", () => {
      slider.scrollBy({ left: slideStep, behavior: "smooth" });
    });

    prevBtn.addEventListener("click", () => {
      slider.scrollBy({ left: -slideStep, behavior: "smooth" });
    });
  }

  // === ОБЩАЯ ФУНКЦИЯ ДЛЯ МОДАЛОК ===
  function setupModal(openBtnId, modalId, closeBtnId) {
    const openBtn = document.getElementById(openBtnId);
    const modal = document.getElementById(modalId);
    const closeBtn = document.getElementById(closeBtnId);

    if (openBtn && modal && closeBtn) {
      openBtn.addEventListener("click", () => {
        modal.style.display = "block";
      });

      closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
      });

      window.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.style.display = "none";
        }
      });
    }
  }

  setupModal("openModalKazakhstan", "modalKazakhstan", "closeModalKazakhstan");
  setupModal("openModalSemey", "modalSemey", "closeModalSemey");


  const burgerBtn = document.getElementById('burger-button');
  const menuPages = document.querySelector('.menu__pages');
  const submenuToggles = document.querySelectorAll('.submenu-toggle');

  // Открытие/закрытие меню по клику на бургер
  burgerBtn.addEventListener('click', () => {
    menuPages.classList.toggle('active');
  });

  // Под меню
submenuToggles.forEach(toggle => {
  toggle.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      const submenu = toggle.nextElementSibling;

      if (!submenu) return;

      if (!submenu.classList.contains('active')) {
        // Первый клик — просто открываем подменю
        e.preventDefault();
        document.querySelectorAll('.submenu').forEach(sub => sub.classList.remove('active'));
        submenu.classList.add('active');
      } else {
        // Второй клик — даем перейти по ссылке (ничего не делаем)
      }
    }
  });
});


  // При изменении ширины окна — сбросить меню и подменю, если ширина > 768px
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      menuPages.classList.remove('active');
      document.querySelectorAll('.submenu.active').forEach(sub => sub.classList.remove('active'));
    }
  });


  document.getElementById('burger-button').addEventListener('click', function() {
  document.getElementById('menu-body').classList.toggle('active');
});



  const toggles = document.querySelectorAll('.accordion-toggle');

  toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      document.querySelectorAll('.accordion-content').forEach(content => {
        if (content !== toggle.nextElementSibling) {
          content.style.display = 'none';
        }
      });

      const content = toggle.nextElementSibling;
      content.style.display = content.style.display === 'block' ? 'none' : 'block';
    });
  });

    // Студенты
    const studentButtons = document.querySelectorAll('.open-students-modal');
    const studentModal = document.getElementById('studentsModal');

    studentButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            studentModal.style.display = 'block';
        });
    });

    // Преподаватели
    const teacherButtons = document.querySelectorAll('.open-teacher-modal');
    const teacherModal = document.getElementById('Teacher');

    teacherButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            teacherModal.style.display = 'block';
        });
    });

    // Закрытие по "X"
    const closeButtons = document.querySelectorAll('.modal .close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            btn.closest('.modal').style.display = 'none';
        });
    });

    // Закрытие по клику вне окна
    window.addEventListener('click', function (event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });


    // === ОБРАБОТЧИКИ ДЛЯ МОДАЛОК СТРАН ===
document.querySelectorAll('.btn-universities').forEach(button => {
    button.addEventListener('click', () => {
        const country = button.getAttribute('data-country');
        const modal = document.getElementById(`modal-${country}`);
        if (modal) {
            modal.style.display = "block";
        }
    });
});

});

