// Utility functions for the strategy game

class Utils {
    // Message system
    static showMessage(message, type = 'info') {
        const container = document.getElementById('message-container');
        if (!container) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;

        container.appendChild(messageDiv);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 5000);

        // Allow manual removal by clicking
        messageDiv.addEventListener('click', () => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        });
    }

    static showSuccess(message) {
        this.showMessage(message, 'success');
    }

    static showError(message) {
        this.showMessage(message, 'error');
    }

    static showInfo(message) {
        this.showMessage(message, 'info');
    }

    // API calls
    static async apiCall(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'API call failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static async get(url) {
        return this.apiCall(url, { method: 'GET' });
    }

    static async post(url, data) {
        return this.apiCall(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // Form validation
    static validateForm(formElement) {
        const inputs = formElement.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!input.value.trim()) {
                this.showFieldError(input, 'Dieses Feld ist erforderlich');
                isValid = false;
            } else {
                this.clearFieldError(input);
            }
        });

        return isValid;
    }

    static showFieldError(input, message) {
        this.clearFieldError(input);
        
        input.style.borderColor = '#f44336';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        errorDiv.style.color = '#f44336';
        errorDiv.style.fontSize = '0.9rem';
        errorDiv.style.marginTop = '0.3rem';
        
        input.parentNode.appendChild(errorDiv);
    }

    static clearFieldError(input) {
        input.style.borderColor = '';
        const existingError = input.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }

    // URL parameters
    static getUrlParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    static setUrlParameter(name, value) {
        const url = new URL(window.location);
        url.searchParams.set(name, value);
        window.history.replaceState({}, '', url);
    }

    // Local storage helpers
    static saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.warn('Could not save to localStorage:', error);
        }
    }

    static getFromStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn('Could not read from localStorage:', error);
            return defaultValue;
        }
    }

    static removeFromStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn('Could not remove from localStorage:', error);
        }
    }

    // Time formatting
    static formatTime(date) {
        return new Date(date).toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static formatDateTime(date) {
        return new Date(date).toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // String helpers
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static truncate(text, length = 50) {
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
    }

    // DOM helpers
    static createElement(tag, className = '', textContent = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (textContent) element.textContent = textContent;
        return element;
    }

    static clearElement(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    // Loading states
    static showLoading(element, message = 'Lädt...') {
        this.clearElement(element);
        
        const loadingDiv = this.createElement('div', 'loading');
        const spinner = this.createElement('div', 'spinner');
        const text = document.createTextNode(message);
        
        loadingDiv.appendChild(spinner);
        loadingDiv.appendChild(text);
        element.appendChild(loadingDiv);
    }

    static hideLoading(element) {
        const loading = element.querySelector('.loading');
        if (loading) {
            loading.remove();
        }
    }

    // Modal helpers
    static showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    static hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    // Game specific helpers
    static getGameId() {
        const pathParts = window.location.pathname.split('/');
        return pathParts[2]; // Assuming format /lobby/123 or /game/123
    }

    static getPlayerName() {
        return this.getUrlParameter('player') || this.getFromStorage('playerName');
    }

    static savePlayerName(name) {
        this.saveToStorage('playerName', name);
    }

    // Debounce function for input events
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Random ID generator
    static generateId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    // Copy to clipboard
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showSuccess('In die Zwischenablage kopiert!');
        } catch (error) {
            console.error('Could not copy to clipboard:', error);
            this.showError('Kopieren fehlgeschlagen');
        }
    }

    // Redirect with player info
    static redirectToGame(url, playerName) {
        if (playerName) {
            this.savePlayerName(playerName);
            const separator = url.includes('?') ? '&' : '?';
            window.location.href = `${url}${separator}player=${encodeURIComponent(playerName)}`;
        } else {
            window.location.href = url;
        }
    }

    // Format numbers
    static formatNumber(num) {
        return new Intl.NumberFormat('de-DE').format(num);
    }

    // Validate player name
    static validatePlayerName(name) {
        if (!name || name.trim().length === 0) {
            return 'Spielername ist erforderlich';
        }
        if (name.trim().length < 2) {
            return 'Spielername muss mindestens 2 Zeichen lang sein';
        }
        if (name.trim().length > 50) {
            return 'Spielername darf maximal 50 Zeichen lang sein';
        }
        if (!/^[a-zA-Z0-9äöüÄÖÜß\s-_]+$/.test(name.trim())) {
            return 'Spielername enthält ungültige Zeichen';
        }
        return null;
    }
}

// Make Utils globally available
window.Utils = Utils;