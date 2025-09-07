// Game Chat System - FIXED VERSION with proper sync
class GameChat {
    constructor(socket, gameId, playerName) {
        this.socket = socket;
        this.gameId = gameId;
        this.playerName = playerName;
        
        // Rate limiting
        this.lastMessageTime = 0;
        this.messageHistory = [];
        
        this.init();
    }

    init() {
        console.log('💬 Initializing game chat...');
        this.setupChatEvents();
        this.loadChatHistory();
    }

    setupChatEvents() {
        // Chat input events
        const chatInput = document.getElementById('chat-input');
        const sendChatBtn = document.getElementById('send-chat');

        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            // Auto-resize for textarea
            chatInput.addEventListener('input', (e) => {
                if (e.target.tagName === 'TEXTAREA') {
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                }
            });
        }

        if (sendChatBtn) {
            sendChatBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        console.log('✅ Chat events setup complete');
    }

    async loadChatHistory() {
        try {
            console.log('📜 Loading chat history...');
            
            const messages = await Utils.get(`/api/games/${this.gameId}/chat`);
            
            // Clear existing messages
            this.messageHistory = [];
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
            
            console.log(`✅ Loaded ${messages.length} chat messages`);
            
        } catch (error) {
            console.error('❌ Error loading chat history:', error);
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

        // ✅ CRITICAL FIX: Ensure socket is connected before sending
        if (!this.socket || !this.socket.connected) {
            this.addSystemMessage('Nicht mit dem Server verbunden');
            return;
        }

        console.log('📤 Sending chat message:', message);

        // Send via socket
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
    }

    // ✅ CRITICAL FIX: Proper incoming message handling
    handleIncomingMessage(messageData) {
        console.log('📨 Handling incoming chat message:', messageData);
        
        this.addMessage({
            playerName: messageData.playerName,
            message: messageData.message,
            timestamp: messageData.timestamp || new Date().toISOString()
        }, true); // Auto-scroll for new messages
    }

    addMessage(messageData, autoScroll = true) {
        const { playerName, message, timestamp } = messageData;
        
        // Prevent duplicate messages
        const messageKey = `${playerName}-${message}-${timestamp}`;
        if (this.messageHistory.includes(messageKey)) {
            console.log('🔄 Duplicate message prevented:', messageKey);
            return;
        }
        
        this.messageHistory.push(messageKey);
        
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        
        // Mark own messages
        if (playerName === this.playerName) {
            messageElement.classList.add('own-message');
        }

        const timeFormatted = this.formatTimestamp(timestamp);
        
        messageElement.innerHTML = `
            <div class="chat-message-header">
                <span class="chat-message-sender">${Utils.escapeHtml(playerName)}</span>
                <span class="chat-message-time">${timeFormatted}</span>
            </div>
            <div class="chat-message-content">${Utils.escapeHtml(message)}</div>
        `;

        chatMessages.appendChild(messageElement);

        // Auto-scroll if requested and user is near bottom
        if (autoScroll) {
            const isNearBottom = chatMessages.scrollTop + chatMessages.clientHeight >= chatMessages.scrollHeight - 50;
            if (isNearBottom) {
                this.scrollToBottom();
            }
        }

        // Limit message history in DOM (keep last 100 messages)
        const messages = chatMessages.querySelectorAll('.chat-message');
        if (messages.length > 100) {
            messages[0].remove();
        }
    }

    addSystemMessage(message) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message system-message';
        
        messageElement.innerHTML = `
            <div class="chat-message-content">${Utils.escapeHtml(message)}</div>
        `;

        chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    scrollToBottom() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            setTimeout(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 100);
        }
    }

    isSpamming() {
        const now = Date.now();
        const timeSinceLastMessage = now - this.lastMessageTime;
        return timeSinceLastMessage < 1000; // 1 second cooldown
    }

    formatTimestamp(timestamp) {
        try {
            const date = new Date(timestamp);
            return date.toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return '';
        }
    }

    // ✅ NEW: Method to clear chat (for debugging)
    clearChat() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            Utils.clearElement(chatMessages);
        }
        this.messageHistory = [];
    }

    // ✅ NEW: Method to check connection status
    getConnectionStatus() {
        return {
            connected: this.socket && this.socket.connected,
            gameId: this.gameId,
            playerName: this.playerName,
            messageCount: this.messageHistory.length
        };
    }
}