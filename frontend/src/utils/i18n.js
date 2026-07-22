// ============================================================
// Orbiton i18n Localization Dictionary & Translation Engine
// Supported: English (en), Tiếng Việt (vi), Español (es)
// Community Open Architecture: Add new language keys to translations object!
// ============================================================
import { useState, useEffect } from 'react';

export const translations = {
  en: {
    // Brand & Header
    brand: {
      tagline: 'Lightweight Server Orchestrator',
      quick_search: 'Quick Search (Ctrl+K)',
      profile: 'Profile',
      logout: 'Sign Out'
    },
    // Navigation
    nav: {
      dashboard: 'Dashboard',
      apps: 'Applications',
      nodes: 'Nodes & Cluster',
      runtimes: 'Global Runtimes',
      users: 'Users & Roles',
      monitor: 'Live Monitor',
      settings: 'Settings & Security'
    },
    // Common
    common: {
      save: 'Save Changes',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      loading: 'Loading...',
      status: 'Status',
      actions: 'Actions',
      refresh: 'Refresh',
      copy: 'Copy',
      copied: 'Copied!',
      search_placeholder: 'Type to filter...',
      confirm: 'Are you sure?',
      success: 'Operation completed successfully',
      error: 'An error occurred'
    },
    // Dashboard
    dashboard: {
      welcome: 'System Overview & Telemetry',
      active_apps: 'Active Applications',
      cluster_nodes: 'Cluster Worker Nodes',
      cpu_usage: 'Cluster CPU Load',
      ram_usage: 'Cluster Memory Load',
      disk_usage: 'Cluster Storage',
      quick_actions: 'Quick Operations',
      create_app: 'Deploy App',
      add_node: 'Link Node',
      security_feed: 'Live Security Audit Feed',
      no_events: 'No recent security events detected.'
    },
    // Apps Page
    apps: {
      title: 'Application Management',
      subtitle: 'Manage and orchestrate containers and bot instances across worker nodes',
      deploy_new: 'Deploy Application',
      import_git: 'Import Git Repo',
      import_docker: 'Import Docker Image',
      filter_all: 'All Runtimes',
      filter_running: 'Running',
      filter_stopped: 'Stopped',
      no_apps: 'No applications found. Create your first app to get started!'
    },
    // Terminal & HUD
    console: {
      hud_title: 'Process Stream HUD',
      interrupt: 'Interrupt (Ctrl+C)',
      clear_log: 'Clear Screen',
      copy_all: 'Copy Logs',
      auto_scroll: 'Auto Scroll',
      latency: 'Latency',
      type_cmd: 'Type command and press Enter...'
    },
    // Settings & Branding
    settings: {
      title: 'Settings & Security Hardening',
      panel_name: 'Panel Name / Branding',
      panel_name_desc: 'Customize the display title shown in header and browser tab',
      save_branding: 'Save Branding',
      theme_selector: 'Theme Palette',
      language_selector: 'System Language',
      security_shield: 'Fail2ban DDoS Shield',
      ip_blacklist: 'IP Ban Blacklist',
      unblock: 'Unblock IP'
    }
  },
  vi: {
    brand: {
      tagline: 'Hệ thống Quản lý VPS & App Siêu Nhẹ',
      quick_search: 'Tìm nhanh (Ctrl+K)',
      profile: 'Tài khoản',
      logout: 'Đăng xuất'
    },
    nav: {
      dashboard: 'Tổng Quan',
      apps: 'Ứng Dụng',
      nodes: 'Nút Cluster',
      runtimes: 'Môi Trường Runtime',
      users: 'Tài Khoản & Quyền',
      monitor: 'Giám Sát Realtime',
      settings: 'Cài Đặt & Bảo Mật'
    },
    common: {
      save: 'Lưu Thay Đổi',
      cancel: 'Hủy',
      delete: 'Xóa',
      edit: 'Chỉnh sửa',
      close: 'Đóng',
      loading: 'Đang tải...',
      status: 'Trạng thái',
      actions: 'Thao tác',
      refresh: 'Làm mới',
      copy: 'Sao chép',
      copied: 'Đã chép!',
      search_placeholder: 'Gõ để tìm kiếm...',
      confirm: 'Bạn có chắc chắn?',
      success: 'Thực hiện thành công',
      error: 'Đã xảy ra lỗi'
    },
    dashboard: {
      welcome: 'Tổng Quan Hệ Thống & Chỉ Số',
      active_apps: 'Ứng Dụng Hoạt Động',
      cluster_nodes: 'Số Node VPS Kết Nối',
      cpu_usage: 'Tải CPU Cluster',
      ram_usage: 'Tải Bộ Nhớ RAM',
      disk_usage: 'Dung Lượng Ô Đĩa',
      quick_actions: 'Thao Tác Nhanh',
      create_app: 'Tạo Ứng Dụng',
      add_node: 'Thêm Node VPS',
      security_feed: 'Nhật Ký Bảo Mật Realtime',
      no_events: 'Không có sự kiện an ninh bất thường.'
    },
    apps: {
      title: 'Quản Lý Ứng Dụng',
      subtitle: 'Quản lý và điều phối các ứng dụng, bot trên các Node VPS worker',
      deploy_new: 'Tạo App Mới',
      import_git: 'Nhập Từ Git',
      import_docker: 'Nhập Từ Docker',
      filter_all: 'Tất cả Runtime',
      filter_running: 'Đang Chạy',
      filter_stopped: 'Đã Dừng',
      no_apps: 'Chưa có ứng dụng nào. Hãy tạo ứng dụng đầu tiên!'
    },
    console: {
      hud_title: 'Bảng Điều Khiển Tiến Trình',
      interrupt: 'Ngắt Lệnh (Ctrl+C)',
      clear_log: 'Xóa Màn Hình',
      copy_all: 'Chép Tất Cả Log',
      auto_scroll: 'Tự Tắt/Mở Cuộn',
      latency: 'Độ Trễ',
      type_cmd: 'Nhập lệnh và nhấn Enter...'
    },
    settings: {
      title: 'Cài Đặt & Bảo Mật Hệ Thống',
      panel_name: 'Tên Thương Hiệu Panel',
      panel_name_desc: 'Thay đổi tên hiển thị ở thanh Header và tiêu đề trình duyệt',
      save_branding: 'Lưu Tên Panel',
      theme_selector: 'Giao Diện Palette',
      language_selector: 'Ngôn Ngữ Hệ Thống',
      security_shield: 'Lá Chắn DDoS Fail2ban',
      ip_blacklist: 'Danh Sách IP Bị Cấm',
      unblock: 'Bỏ Cấm IP'
    }
  },
  es: {
    brand: {
      tagline: 'Orquestador de Servidores Ligero',
      quick_search: 'Búsqueda Rápida (Ctrl+K)',
      profile: 'Perfil',
      logout: 'Cerrar Sesión'
    },
    nav: {
      dashboard: 'Panel General',
      apps: 'Aplicaciones',
      nodes: 'Nodos y Cluster',
      runtimes: 'Entornos Runtime',
      users: 'Usuarios y Roles',
      monitor: 'Monitoreo en Vivo',
      settings: 'Ajustes y Seguridad'
    },
    common: {
      save: 'Guardar Cambios',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      close: 'Cerrar',
      loading: 'Cargando...',
      status: 'Estado',
      actions: 'Acciones',
      refresh: 'Actualizar',
      copy: 'Copiar',
      copied: '¡Copiado!',
      search_placeholder: 'Escriba para buscar...',
      confirm: '¿Está seguro?',
      success: 'Operación completada con éxito',
      error: 'Se produjo un error'
    },
    dashboard: {
      welcome: 'Resumen del Sistema y Telemetría',
      active_apps: 'Aplicaciones Activas',
      cluster_nodes: 'Nodos del Cluster',
      cpu_usage: 'Carga de CPU',
      ram_usage: 'Uso de Memoria RAM',
      disk_usage: 'Almacenamiento',
      quick_actions: 'Operaciones Rápidas',
      create_app: 'Desplegar App',
      add_node: 'Vincular Nodo',
      security_feed: 'Registro de Seguridad en Vivo',
      no_events: 'No se detectaron eventos de seguridad recientes.'
    },
    apps: {
      title: 'Gestión de Aplicaciones',
      subtitle: 'Administre y orqueste instancias en sus nodos de trabajo',
      deploy_new: 'Desplegar Aplicación',
      import_git: 'Importar de Git',
      import_docker: 'Importar de Docker',
      filter_all: 'Todos los Runtimes',
      filter_running: 'En Ejecución',
      filter_stopped: 'Detenido',
      no_apps: '¡No hay aplicaciones! Cree la primera aplicación para comenzar.'
    },
    console: {
      hud_title: 'Consola del Proceso',
      interrupt: 'Interrumpir (Ctrl+C)',
      clear_log: 'Limpiar Pantalla',
      copy_all: 'Copiar Logs',
      auto_scroll: 'Desplazamiento Auto',
      latency: 'Latencia',
      type_cmd: 'Escriba un comando y presione Enter...'
    },
    settings: {
      title: 'Configuración y Seguridad',
      panel_name: 'Nombre del Panel / Marca',
      panel_name_desc: 'Personalice el título que se muestra en el encabezado y en la pestaña del navegador',
      save_branding: 'Guardar Marca',
      theme_selector: 'Tema de Color',
      language_selector: 'Idioma del Sistema',
      security_shield: 'Protección DDoS Fail2ban',
      ip_blacklist: 'Lista Negra de IP',
      unblock: 'Desbloquear IP'
    }
  }
};

let currentLang = localStorage.getItem('orbiton_language') || 'en';
const listeners = new Set();

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem('orbiton_language', lang);
    listeners.forEach(cb => cb(lang));
  }
}

export function getLanguage() {
  return currentLang;
}

export function t(pathStr, fallback = '') {
  const parts = pathStr.split('.');
  let obj = translations[currentLang] || translations.en;
  for (const p of parts) {
    if (!obj || typeof obj !== 'object') return fallback || pathStr;
    obj = obj[p];
  }
  return obj || fallback || pathStr;
}

export function useTranslation() {
  const [lang, setLang] = useState(currentLang);

  useEffect(() => {
    const cb = (newLang) => setLang(newLang);
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, []);

  return {
    t: (pathStr, fallback) => t(pathStr, fallback),
    lang,
    setLanguage
  };
}
