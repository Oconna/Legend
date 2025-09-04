// Game Chat System - Reusable across pages
class GameChat {
    constructor(gameId, playerName, socket) {
        this.gameId = gameId;
        this.playerName = playerName;
        this.socket = socket;
        this.messages = [];
        this.maxMessages = 100;
        this.isInitialized = false;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadChatHistory();
        this.isInitialized = true;
    }

    bindEvents() {
        // Chat input events
        const chatInput = document.getElementById('chat-input');
        const sendChat = document.getElementById('send-chat');
        
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            // Auto-resize textarea if it's a textarea
            if (chatInput.tagName === 'TEXTAREA') {
                chatInput.addEventListener('input', () => {
                    this.autoResizeTextarea(chatInput);
                });
            }
        }

        if (sendChat) {
            sendChat.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        // Socket events
        if (this.socket) {
            this.socket.on('chat-message', (message) => {
                this.handleIncomingMessage(message);
            });
        }

        // Focus chat input with keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && 
                document.activeElement !== chatInput) {
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.tagName === 'INPUT' || 
                    activeElement.tagName === 'TEXTAREA')) {
                    return; // Don't interfere with other inputs
                }
                
                if (chatInput) {
                    chatInput.focus();
                    e.preventDefault();
                }
            }
        });
    }

    async loadChatHistory() {
        if (!this.gameId) return;

        try {
            const messages = await Utils.get(`/api/games/${this.gameId}/chat`);
            
            // Clear existing messages
            this.messages = [];
            const chatMessages = document.getElementById('chat-messages');
            if (chatMessages) {
                Utils.clearElement(chatMessages);
            }

            // Add messages
            messages.forEach(message => {
                this.addMessage({
                    playerName: message.player_name,
                    message: message.message,
                    timestamp: message.created_at
                }, false); // Don't auto-scroll for history
            });

            // Scroll to bottom after loading history
            this.scrollToBottom();
            
            console.log(`Loaded ${messages.length} chat messages`);
            
        } catch (error) {
            console.error('Error loading chat history:', error);
            this.addSystemMessage('Fehler beim Laden des Chat-Verlaufs');
        }
    }

    sendMessage() {
        const chatInput = document.getElementById('chat-input');
        if (!chatInput) return;

        const message = chatInput.value.trim();
        if (!message) return;

        // Validate message length
        if (message.length > 500) {
            this.addSystemMessage('Nachricht ist zu lang (max. 500 Zeichen)');
            return;
        }

        // Check for spam (basic rate limiting)
        if (this.isSpamming()) {
            this.addSystemMessage('Zu schnell! Warte einen Moment...');
            return;
        }

        // Send via socket
        if (this.socket && this.socket.connected) {
            this.socket.emit('send-chat-message', {
                gameId: this.gameId,
                playerName: this.playerName,
                message: message
            });

            // Clear input
            chatInput.value = '';
            
            // Reset textarea height if applicable
            if (chatInput.tagName === 'TEXTAREA') {
                chatInput.style.height = 'auto';
            }

            // Update last message time for spam protection
            this.lastMessageTime = Date.now();
            
        } else {
            this.addSystemMessage('Nicht mit dem Server verbunden');
        }
    }

    handleIncomingMessage(messageData) {
        this.addMessage({
            playerName: messageData.playerName,
            message: messageData.message,
            timestamp: messageData.timestamp || new Date().toISOString()
        });
    }

    addMessage(messageData, autoScroll = true) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        // Add to messages array
        this.messages.push(messageData);

        // Limit message history
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }

        // Create message element
        const messageElement = this.createMessageElement(messageData);
        chatMessages.appendChild(messageElement);

        // Remove old messages from DOM if too many
        while (chatMessages.children.length > this.maxMessages) {
            chatMessages.removeChild(chatMessages.firstChild);
        }

        // Auto-scroll to bottom if user was at bottom
        if (autoScroll) {
            this.scrollToBottom();
        }

        // Highlight mention of current player
        if (messageData.message.toLowerCase().includes(this.playerName.toLowerCase()) &&
            messageData.playerName !== this.playerName) {
            messageElement.classList.add('mentioned');
            this.showNotification(`${messageData.playerName} hat dich erwähnt`);
        }
    }

    createMessageElement(messageData) {
        const messageDiv = Utils.createElement('div', 'chat-message');
        
        // Add special styling for different message types
        if (messageData.playerName === this.playerName) {
            messageDiv.classList.add('own-message');
        } else if (messageData.playerName === 'System') {
            messageDiv.classList.add('system-message');
        }

        const timestamp = Utils.formatTime(messageData.timestamp);
        const isOwnMessage = messageData.playerName === this.playerName;
        
        // Escape HTML in message content
        const safeMessage = this.formatMessage(messageData.message);
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="player-name ${isOwnMessage ? 'own' : ''}">${Utils.escapeHtml(messageData.playerName)}:</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${safeMessage}</div>
        `;

        return messageDiv;
    }

    formatMessage(message) {
        let formatted = Utils.escapeHtml(message);
        
        // Basic emoji support
        const emojiMap = {
            ':)': '🙂', ':-)': '🙂', ':(': '🙁', ':-(': '🙁',
            ':D': '😄', ':-D': '😄', ':P': '😛', ':-P': '😛',
            ';)': '😉', ';-)': '😉', ':o': '😮', ':-o': '😮',
            ':thumbsup:': '👍', ':thumbsdown:': '👎',
            ':heart:': '❤️', ':fire:': '🔥', ':star:': '⭐'
        };

        Object.keys(emojiMap).forEach(emoticon => {
            const regex = new RegExp(Utils.escapeHtml(emoticon).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            formatted = formatted.replace(regex, emojiMap[emoticon]);
        });

        // Simple URL detection and linking
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');

        return formatted;
    }

    addSystemMessage(message) {
        this.addMessage({
            playerName: 'System',
            message: message,
            timestamp: new Date().toISOString()
        });
    }

    scrollToBottom() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    isSpamming() {
        if (!this.lastMessageTime) {
            this.lastMessageTime = Date.now();
            return false;
        }

        const timeSinceLastMessage = Date.now() - this.lastMessageTime;
        const minInterval = 1000; // 1 second minimum between messages

        return timeSinceLastMessage < minInterval;
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
    }

    showNotification(message) {
        // Simple notification - you could enhance this with browser notifications
        if (document.hidden) {
            // Page is not visible, could use browser notification API
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Strategy Game', {
                    body: message,
                    icon: '/favicon.ico'
                });
            }
        }

        // In-app notification
        Utils.showInfo(message);
    }

    // Public methods for external control
    clearChat() {
        this.messages = [];
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            Utils.clearElement(chatMessages);
        }
    }

    setPlayerName(newPlayerName) {
        this.playerName = newPlayerName;
    }

    focusInput() {
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.focus();
        }
    }

    // Export chat history
    exportChatHistory() {
        const chatData = {
            gameId: this.gameId,
            exportDate: new Date().toISOString(),
            messages: this.messages
        };

        const blob = new Blob([JSON.stringify(chatData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-history-${this.gameId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Mute/unmute players (client-side only)
    togglePlayerMute(playerName) {
        this.mutedPlayers = this.mutedPlayers || new Set();
        
        if (this.mutedPlayers.has(playerName)) {
            this.mutedPlayers.delete(playerName);
            this.addSystemMessage(`${playerName} wurde entmutete`);
        } else {
            this.mutedPlayers.add(playerName);
            this.addSystemMessage(`${playerName} wurde stummgeschaltet`);
        }

        // Update existing messages
        this.refreshMessageVisibility();
    }

    refreshMessageVisibility() {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages || !this.mutedPlayers) return;

        Array.from(chatMessages.children).forEach(messageElement => {
            const playerNameElement = messageElement.querySelector('.player-name');
            if (playerNameElement) {
                const playerName = playerNameElement.textContent.replace(':', '');
                if (this.mutedPlayers.has(playerName)) {
                    messageElement.style.opacity = '0.3';
                    messageElement.style.fontSize = '0.8em';
                } else {
                    messageElement.style.opacity = '1';
                    messageElement.style.fontSize = '';
                }
            }
        });
    }

    // Enable/disable chat
    setEnabled(enabled) {
        const chatInput = document.getElementById('chat-input');
        const sendChat = document.getElementById('send-chat');

        if (chatInput) chatInput.disabled = !enabled;
        if (sendChat) sendChat.disabled = !enabled;

        if (!enabled) {
            this.addSystemMessage('Chat wurde deaktiviert');
        }
    }

    // Get message count
    getMessageCount() {
        return this.messages.length;
    }

    // Get recent messages
    getRecentMessages(count = 10) {
        return this.messages.slice(-count);
    }

    // Search messages
    searchMessages(query) {
        const lowerQuery = query.toLowerCase();
        return this.messages.filter(msg => 
            msg.message.toLowerCase().includes(lowerQuery) ||
            msg.playerName.toLowerCase().includes(lowerQuery)
        );
    }

    // Update socket connection
    updateSocket(newSocket) {
        this.socket = newSocket;
        if (this.isInitialized) {
            this.bindEvents(); // Re-bind socket events
        }
    }

    // Cleanup
    destroy() {
        // Remove event listeners if needed
        this.isInitialized = false;
    }
}