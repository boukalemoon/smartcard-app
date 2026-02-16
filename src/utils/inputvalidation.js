// src/utils/inputValidation.js

/**
 * Güvenli input validation ve sanitization
 */

// XSS koruması için HTML encode
export const sanitizeHtml = (input) => {
  if (typeof input !== 'string') return input;
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return input.replace(/[&<>"'/]/g, (char) => map[char]);
};

// URL validation
export const isValidUrl = (url) => {
  try {
    const urlObj = new URL(url);
    // Sadece http ve https protokollerine izin ver
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

// Email validation
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Telefon numarası validation (Türkiye)
export const isValidPhone = (phone) => {
  // Türkiye telefon formatı: +90XXXXXXXXXX veya 0XXXXXXXXXX
  const phoneRegex = /^(\+90|0)?[0-9]{10}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

// Katalog linki validation ve sanitization
export const validateCatalogLink = (link) => {
  const errors = [];
  
  // Title kontrolü
  if (!link.title || link.title.trim().length === 0) {
    errors.push('Başlık boş olamaz');
  }
  if (link.title && link.title.length > 100) {
    errors.push('Başlık 100 karakterden uzun olamaz');
  }
  
  // URL kontrolü
  if (!link.url || !isValidUrl(link.url)) {
    errors.push('Geçerli bir URL giriniz');
  }
  
  // Tehlikeli protokolleri engelle
  if (link.url && (link.url.includes('javascript:') || link.url.includes('data:'))) {
    errors.push('Güvenlik nedeniyle bu URL kullanılamaz');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    sanitized: {
      title: sanitizeHtml(link.title.trim()),
      url: link.url.trim(),
      type: link.type || 'document'
    }
  };
};

// Hizmet validation
export const validateService = (service) => {
  const errors = [];
  
  if (!service.title || service.title.trim().length === 0) {
    errors.push('Hizmet adı boş olamaz');
  }
  if (service.title && service.title.length > 100) {
    errors.push('Hizmet adı 100 karakterden uzun olamaz');
  }
  
  if (!service.description || service.description.trim().length === 0) {
    errors.push('Açıklama boş olamaz');
  }
  if (service.description && service.description.length > 500) {
    errors.push('Açıklama 500 karakterden uzun olamaz');
  }
  
  if (!service.price || isNaN(parseFloat(service.price))) {
    errors.push('Geçerli bir fiyat giriniz');
  }
  if (service.price && parseFloat(service.price) < 0) {
    errors.push('Fiyat negatif olamaz');
  }
  if (service.price && parseFloat(service.price) > 1000000) {
    errors.push('Fiyat çok yüksek');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    sanitized: {
      title: sanitizeHtml(service.title.trim()),
      description: sanitizeHtml(service.description.trim()),
      price: parseFloat(service.price),
      currency: 'TRY',
      delivery_time: service.delivery_time ? sanitizeHtml(service.delivery_time.trim()) : null,
      category: 'general'
    }
  };
};

// Profil bilgileri validation
export const validateProfile = (profile) => {
  const errors = {};
  
  if (profile.name && profile.name.length > 100) {
    errors.name = 'İsim 100 karakterden uzun olamaz';
  }
  
  if (profile.title && profile.title.length > 100) {
    errors.title = 'Ünvan 100 karakterden uzun olamaz';
  }
  
  if (profile.company && profile.company.length > 100) {
    errors.company = 'Şirket adı 100 karakterden uzun olamaz';
  }
  
  if (profile.phone && !isValidPhone(profile.phone)) {
    errors.phone = 'Geçerli bir telefon numarası giriniz';
  }
  
  if (profile.bio && profile.bio.length > 500) {
    errors.bio = 'Hakkımda 500 karakterden uzun olamaz';
  }
  
  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    sanitized: {
      name: profile.name ? sanitizeHtml(profile.name.trim()) : null,
      title: profile.title ? sanitizeHtml(profile.title.trim()) : null,
      company: profile.company ? sanitizeHtml(profile.company.trim()) : null,
      phone: profile.phone ? profile.phone.trim() : null,
      bio: profile.bio ? sanitizeHtml(profile.bio.trim()) : null
    }
  };
};

// Google Review Link validation
export const validateGoogleReviewLink = (url) => {
  if (!url || !isValidUrl(url)) {
    return { valid: false, error: 'Geçerli bir URL giriniz' };
  }
  
  // Google domain kontrolü
  const validDomains = ['google.com', 'g.page', 'maps.google.com', 'goo.gl'];
  try {
    const urlObj = new URL(url);
    const isGoogleDomain = validDomains.some(domain => 
      urlObj.hostname.includes(domain)
    );
    
    if (!isGoogleDomain) {
      return { valid: false, error: 'Sadece Google linki kabul edilir' };
    }
  } catch {
    return { valid: false, error: 'Geçersiz URL formatı' };
  }
  
  return { valid: true, sanitized: url.trim() };
};

// Rate limiting helper (client-side)
export const createRateLimiter = (maxRequests, windowMs) => {
  const requests = [];
  
  return () => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Eski istekleri temizle
    while (requests.length > 0 && requests[0] < windowStart) {
      requests.shift();
    }
    
    if (requests.length >= maxRequests) {
      return false; // Rate limit aşıldı
    }
    
    requests.push(now);
    return true; // İstek yapılabilir
  };
};