// =========================================
// Mobile Navigation
// =========================================

const menuBtn = document.querySelector(".menu-btn");
const navLinks = document.querySelector(".nav-links");

if (menuBtn) {
  
  menuBtn.addEventListener("click", () => {
    
    navLinks.classList.toggle("show");
    
    if (navLinks.classList.contains("show")) {
      menuBtn.innerHTML = '<i class="fas fa-times"></i>';
    } else {
      menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
    }
    
  });
  
}

// =========================================
// Sticky Header Shadow
// =========================================

const header = document.querySelector("header");

window.addEventListener("scroll", () => {
  
  if (window.scrollY > 60) {
    
    header.style.background = "#08384D";
    header.style.boxShadow = "0 10px 25px rgba(0,0,0,.25)";
    
  } else {
    
    header.style.background = "#0B4F6C";
    header.style.boxShadow = "0 5px 15px rgba(0,0,0,.15)";
    
  }
  
});

// =========================================
// Active Navigation
// =========================================

const links = document.querySelectorAll(".nav-links a");

links.forEach(link => {
  
  link.addEventListener("click", function() {
    
    links.forEach(item => item.classList.remove("active"));
    
    this.classList.add("active");
    
  });
  
});

// =========================================
// Scroll Reveal Animation
// =========================================

const revealItems = document.querySelectorAll(
  ".card, .about-grid div, .principal-grid, .news-grid article"
);

const revealOnScroll = () => {
  
  revealItems.forEach(item => {
    
    const top = item.getBoundingClientRect().top;
    
    const windowHeight = window.innerHeight;
    
    if (top < windowHeight - 100) {
      
      item.style.opacity = "1";
      item.style.transform = "translateY(0)";
      
    }
    
  });
  
};

revealItems.forEach(item => {
  
  item.style.opacity = "0";
  item.style.transform = "translateY(60px)";
  item.style.transition = ".8s ease";
  
});

window.addEventListener("scroll", revealOnScroll);

revealOnScroll();

// =========================================
// Animated Statistics
// =========================================

const counters = document.querySelectorAll(".stats h2");

let counted = false;

window.addEventListener("scroll", () => {
  
  const stats = document.querySelector(".statistics");
  
  if (!stats) return;
  
  const statsTop = stats.getBoundingClientRect().top;
  
  if (statsTop < window.innerHeight && !counted) {
    
    counted = true;
    
    counters.forEach(counter => {
      
      const text = counter.innerText;
      
      const number = parseInt(text.replace(/\D/g, ""));
      
      const suffix = text.replace(/[0-9]/g, "");
      
      let count = 0;
      
      const speed = Math.ceil(number / 100);
      
      const update = () => {
        
        count += speed;
        
        if (count >= number) {
          
          counter.innerText = number + suffix;
          
        } else {
          
          counter.innerText = count + suffix;
          
          requestAnimationFrame(update);
          
        }
        
      };
      
      update();
      
    });
    
  }
  
});

// =========================================
// Back To Top Button
// =========================================

const topButton = document.createElement("button");

topButton.innerHTML = "↑";

topButton.className = "backToTop";

document.body.appendChild(topButton);

window.addEventListener("scroll", () => {
  
  if (window.scrollY > 400) {
    
    topButton.classList.add("show");
    
  } else {
    
    topButton.classList.remove("show");
    
  }
  
});

topButton.addEventListener("click", () => {
  
  window.scrollTo({
    
    top: 0,
    behavior: "smooth"
    
  });
  
});

// =========================================
// Hero Fade Animation
// =========================================

window.addEventListener("load", () => {
  
  const hero = document.querySelector(".hero-content");
  
  if (hero) {
    
    hero.style.opacity = "0";
    hero.style.transform = "translate(-50%, -40%)";
    
    setTimeout(() => {
      
      hero.style.transition = "1.2s";
      
      hero.style.opacity = "1";
      hero.style.transform = "translate(-50%, -50%)";
      
    }, 300);
    
  }
  
});

// =========================================
// Image Hover Effect
// =========================================

const images = document.querySelectorAll("img");

images.forEach(img => {
  
  img.addEventListener("mouseenter", () => {
    
    img.style.transition = ".4s";
    
    img.style.transform = "scale(1.03)";
    
  });
  
  img.addEventListener("mouseleave", () => {
    
    img.style.transform = "scale(1)";
    
  });
  
});
/* ===========================
FAQ ACCORDION
=========================== */

const faqQuestions = document.querySelectorAll(".faq-question");

faqQuestions.forEach(question => {
  
  question.addEventListener("click", () => {
    
    const item = question.parentElement;
    
    const answer = item.querySelector(".faq-answer");
    
    const icon = question.querySelector("i");
    
    document.querySelectorAll(".faq-item").forEach(faq => {
      
      if (faq !== item) {
        
        faq.querySelector(".faq-answer").style.maxHeight = null;
        
        faq.querySelector("i").classList.remove("fa-minus");
        
        faq.querySelector("i").classList.add("fa-plus");
        
      }
      
    });
    
    if (answer.style.maxHeight) {
      
      answer.style.maxHeight = null;
      
      icon.classList.remove("fa-minus");
      
      icon.classList.add("fa-plus");
      
    } else {
      
      answer.style.maxHeight = answer.scrollHeight + "px";
      
      icon.classList.remove("fa-plus");
      
      icon.classList.add("fa-minus");
      
    }
    
  });
  
});
/* ==========================================
HERO SLIDER
========================================== */

const slides = document.querySelectorAll(".slide");
const dots = document.querySelectorAll(".dot");

let currentSlide = 0;

function showSlide(index) {
  
  slides.forEach(slide => slide.classList.remove("active"));
  
  dots.forEach(dot => dot.classList.remove("active"));
  
  slides[index].classList.add("active");
  
  dots[index].classList.add("active");
  
}

function nextSlide() {
  
  currentSlide++;
  
  if (currentSlide >= slides.length) {
    
    currentSlide = 0;
    
  }
  
  showSlide(currentSlide);
  
}

function prevSlide() {
  
  currentSlide--;
  
  if (currentSlide < 0) {
    
    currentSlide = slides.length - 1;
    
  }
  
  showSlide(currentSlide);
  
}

setInterval(nextSlide, 5000);

document.getElementById("nextSlide").onclick = nextSlide;

document.getElementById("prevSlide").onclick = prevSlide;

dots.forEach((dot, index) => {
  
  dot.onclick = () => {
    
    currentSlide = index;
    
    showSlide(index);
    
  };
  
});