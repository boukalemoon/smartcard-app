// src/components/landing/ScrollAnimations.jsx
// Landing page'e smooth scroll ve animasyonlar ekler

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ScrollAnimations() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    // Scroll observer
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);

      // Parallax effect için scroll position
      const scrolled = window.scrollY;
      const parallaxElements = document.querySelectorAll('[data-parallax]');
      
      parallaxElements.forEach((el) => {
        const speed = el.getAttribute('data-parallax-speed') || 0.5;
        const yPos = -(scrolled * speed);
        el.style.transform = `translateY(${yPos}px)`;
      });
    };

    // Scroll animation observer
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in-up');
          entry.target.classList.remove('opacity-0', 'translate-y-10');
        }
      });
    }, observerOptions);

    // Animasyonlu elementleri observe et
    const animatedElements = document.querySelectorAll('[data-animate]');
    animatedElements.forEach((el) => {
      el.classList.add('opacity-0', 'translate-y-10', 'transition-all', 'duration-700');
      observer.observe(el);
    });

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <>
      {/* Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-8 right-8 z-50 p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16 pointer-events-none'
        }`}
        aria-label="Scroll to top"
      >
        <ArrowUp size={24} />
      </button>

      {/* Global Animations CSS */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.7s ease-out forwards;
        }

        /* Smooth scroll */
        html {
          scroll-behavior: smooth;
        }

        /* Parallax container */
        [data-parallax] {
          will-change: transform;
        }
      `}</style>
    </>
  );
}