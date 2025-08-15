// race-selection.js - Rassen-Auswahl System (Komplett)

console.log('🏛️ Initialisiere Race Selection System...');

// ========================================
// RACE SELECTION CLASS
// ========================================

class RaceSelection {
    constructor() {
        this.modal = document.getElementById('raceSelectionModal');
        this.racesGrid = document.getElementById('racesGrid');
        this.confirmBtn = document.getElementById('confirmRaceBtn');
        this.statusDisplay = document.getElementById('raceSelectionStatus');
        this.selectedRaceId = null;
        this.isProcessing = false;
        
        this.init();
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    init() {
        this.setupEventListeners();
        this.renderRaces();
        this.setupGameStateListeners();
        
        console.log('✅ Race Selection initialisiert');
    }

    setupEventListeners() {
        // Button Events
        this.confirmBtn.addEventListener('click', () => this.confirmRaceSelection());
        
        // Keyboard Events
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Modal Close Events
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                // Prevent closing modal by clicking outside during race selection
                e.preventDefault();
            }
        });

        // Custom Events from Socket Manager
        window.addEventListener('showRaceSelection', () => this.showModal());
        window.addEventListener('hideRaceSelection', () => this.hideModal());
        window.addEventListener('raceSelectionUpdate', (e) => this.handleRaceUpdate(e.detail));
        window.addEventListener('raceSelectionFailed', (e) => this.handleSelectionFailed(e.detail));
    }

    setupGameStateListeners() {
        // Listen to game state changes
        gameState.on('otherPlayersRacesChanged', () => {
            this.updateRaceAvailability();
            this.updateRaceStatus();
        });

        gameState.on('gamePhaseChanged', (data) => {
            if (data.newValue === GAME_PHASES.RACE_SELECTION) {
                this.showModal();
            } else if (data.newValue === GAME_PHASES.PLAYING) {
                this.hideModal();
            }
        });
    }

    // ========================================
    // RACE RENDERING
    // ========================================

    renderRaces() {
        this.racesGrid.innerHTML = '';
        
        FALLBACK_RACES.forEach((race, index) => {
            const raceCard = this.createRaceCard(race, index);
            this.racesGrid.appendChild(raceCard);
        });
        
        this.updateRaceAvailability();
        console.log(`🏛️ ${FALLBACK_RACES.length} Rassen gerendert`);
    }

    createRaceCard(race, index) {
        const card = document.createElement('div');
        card.className = 'race-card';
        card.dataset.raceId = race.id;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Rasse ${race.name} auswählen`);
        
        card.innerHTML = `
            <div class="race-icon" style="color: ${race.color}">${race.icon}</div>
            <div class="race-name">${race.name}</div>
            <div class="race-description">${race.description}</div>
            <div class="race-special">
                <strong>Spezial:</strong> ${race.specialAbility}
            </div>
            <div class="race-stats">
                <div class="stat-item">
                    <span class="stat-label">Startgold:</span>
                    <span class="stat-value" style="color: #f1c40f;">💰 ${race.startingGold}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Einheiten:</span>
                    <span class="stat-value">${race.units.length}</span>
                </div>
            </div>
            <div class="unit-grid">
                ${race.units.slice(0, 6).map(unit => `
                    <div class="unit-preview" title="${unit.name} - ${unit.cost}💰">
                        <div class="unit-icon">${unit.icon}</div>
                        <div class="unit-name">${unit.name}</div>
                        <div class="unit-cost">${unit.cost}💰</div>
                    </div>
                `).join('')}
                ${race.units.length > 6 ? `
                    <div class="unit-preview more-units">
                        <div class="unit-icon">⋯</div>
                        <div class="unit-name">+${race.units.length - 6}</div>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Event Listeners
        card.addEventListener('click', () => this.selectRace(race.id));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.selectRace(race.id);
            }
        });
        
        // Hover effects
        card.addEventListener('mouseenter', () => this.previewRace(race));
        card.addEventListener('mouseleave', () => this.clearPreview());
        
        return card;
    }

    // ========================================
    // RACE SELECTION LOGIC
    // ========================================

    selectRace(raceId) {
        if (this.isProcessing) return;
        
        const raceCard = this.racesGrid.querySelector(`[data-race-id="${raceId}"]`);
        if (!raceCard || raceCard.classList.contains('taken')) {
            this.showError('Diese Rasse ist nicht verfügbar');
            return;
        }

        // Remove previous selection
        this.racesGrid.querySelectorAll('.race-card').forEach(card => {
            card.classList.remove('selected');
            card.setAttribute('aria-selected', 'false');
        });
        
        // Select new race
        raceCard.classList.add('selected');
        raceCard.setAttribute('aria-selected', 'true');
        raceCard.focus();
        
        this.selectedRaceId = raceId;
        this.confirmBtn.disabled = false;
        
        const race = FALLBACK_RACES.find(r => r.id === raceId);
        this.updateStatus(`✅ ${race.name} ausgewählt - Klicke "Bestätigen" um fortzufahren`);
        
        // Play selection sound effect (if available)
        this.playSound('select');
        
        console.log('🏛️ Rasse ausgewählt:', raceId);
    }

    confirmRaceSelection() {
        if (!this.selectedRaceId || this.isProcessing) return;
        
        this.isProcessing = true;
        this.confirmBtn.disabled = true;
        this.confirmBtn.innerHTML = '<span class="loading-spinner"></span> Sende...';
        
        const race = FALLBACK_RACES.find(r => r.id === this.selectedRaceId);
        
        // Update local game state
        gameState.setSelectedRace(race);
        gameState.updateState('raceConfirmed', true);
        
        // Send to server via socket manager
        if (window.socketManager) {
            const success = window.socketManager.selectRace(this.selectedRaceId);
            
            if (!success) {
                this.handleSelectionFailed({ error: 'Konnte Auswahl nicht senden' });
                return;
            }
        } else {
            console.error('❌ Socket Manager nicht verfügbar');
            this.handleSelectionFailed({ error: 'Keine Serververbindung' });
            return;
        }
        
        // Update UI
        this.updatePlayerDisplay();
        this.updateStatus('⏳ Warte auf andere Spieler...');
        
        // Add our race to the taken list
        gameState.setOtherPlayerRace(gameState.currentPlayer.name, this.selectedRaceId);
        this.updateRaceAvailability();
        
        // Play confirmation sound
        this.playSound('confirm');
        
        console.log('✅ Rasse bestätigt:', race.name);
    }

    // ========================================
    // RACE AVAILABILITY MANAGEMENT
    // ========================================

    updateRaceAvailability() {
        if (!this.racesGrid) return;
        
        this.racesGrid.querySelectorAll('.race-card').forEach(card => {
            const raceId = card.dataset.raceId;
            const isTaken = gameState.isRaceTaken(raceId);
            const isMySelection = this.selectedRaceId === raceId;
            
            if (isTaken && !isMySelection) {
                card.classList.add('taken');
                card.setAttribute('aria-disabled', 'true');
                
                const nameElement = card.querySelector('.race-name');
                if (!nameElement.innerHTML.includes('(Vergeben)')) {
                    nameElement.innerHTML += ' <span style="color: #e74c3c; font-size: 0.8em;">(Vergeben)</span>';
                }
            } else {
                card.classList.remove('taken');
                card.setAttribute('aria-disabled', 'false');
                
                const nameElement = card.querySelector('.race-name');
                nameElement.innerHTML = nameElement.innerHTML.replace(
                    / <span style="color: #e74c3c; font-size: 0.8em;">\(Vergeben\)<\/span>/, 
                    ''
                );
            }
        });
    }

    updateRaceStatus() {
        if (gameState.gamePhase !== GAME_PHASES.RACE_SELECTION) return;
        
        const totalPlayers = gameState.gameSettings?.players?.length || 0;
        const selectedCount = gameState.getAllSelectedRaces().length;
        
        this.updateStatus(`${selectedCount}/${totalPlayers} Spieler haben ihre Rasse gewählt`);
    }

    // ========================================
    // EVENT HANDLERS
    // ========================================

    handleRaceUpdate(data) {
        console.log('🔄 Race update erhalten:', data);
        this.updateRaceAvailability();
        this.updateRaceStatus();
    }

    handleSelectionFailed(data) {
        console.error('❌ Rassen-Auswahl fehlgeschlagen:', data.error);
        
        this.isProcessing = false;
        this.enableConfirmButton();
        this.showError(`Fehler: ${data.error}`);
        
        // Play error sound
        this.playSound('error');
    }

    handleKeyPress(e) {
        if (!this.isModalVisible()) return;
        
        // ESC to cancel (but only if not processing)
        if (e.key === 'Escape' && !this.isProcessing) {
            // Don't allow closing during race selection phase
            if (gameState.gamePhase === GAME_PHASES.RACE_SELECTION) {
                this.showError('Rassen-Auswahl ist erforderlich');
                return;
            }
            this.hideModal();
        }
        
        // Arrow key navigation
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            e.preventDefault();
            this.navigateRaces(e.key);
        }
        
        // Number keys for quick selection
        if (e.key >= '1' && e.key <= '9') {
            const index = parseInt(e.key) - 1;
            if (index < FALLBACK_RACES.length) {
                this.selectRace(FALLBACK_RACES[index].id);
            }
        }
        
        // Enter to confirm
        if (e.key === 'Enter' && this.selectedRaceId && !this.confirmBtn.disabled) {
            this.confirmRaceSelection();
        }
    }

    navigateRaces(direction) {
        const cards = Array.from(this.racesGrid.querySelectorAll('.race-card:not(.taken)'));
        const currentIndex = cards.findIndex(card => card.classList.contains('selected'));
        let newIndex;
        
        switch (direction) {
            case 'ArrowLeft':
                newIndex = currentIndex > 0 ? currentIndex - 1 : cards.length - 1;
                break;
            case 'ArrowRight':
                newIndex = currentIndex < cards.length - 1 ? currentIndex + 1 : 0;
                break;
            case 'ArrowUp':
                newIndex = currentIndex >= 3 ? currentIndex - 3 : currentIndex;
                break;
            case 'ArrowDown':
                newIndex = currentIndex + 3 < cards.length ? currentIndex + 3 : currentIndex;
                break;
        }
        
        if (newIndex !== undefined && cards[newIndex]) {
            const raceId = cards[newIndex].dataset.raceId;
            this.selectRace(raceId);
        }
    }

    // ========================================
    // RACE PREVIEW SYSTEM
    // ========================================

    previewRace(race) {
        // Create detailed preview tooltip or sidebar
        const preview = this.createRacePreview(race);
        this.showPreview(preview);
    }

    createRacePreview(race) {
        return {
            name: race.name,
            description: race.description,
            specialAbility: race.specialAbility,
            startingGold: race.startingGold,
            units: race.units.map(unit => ({
                name: unit.name,
                icon: unit.icon,
                cost: unit.cost,
                stats: unit.baseStats
            }))
        };
    }

    showPreview(preview) {
        // Implementation for showing detailed race preview
        // Could be a tooltip, sidebar, or modal overlay
        console.log('👁️ Race Preview:', preview.name);
    }

    clearPreview() {
        // Clear any active previews
    }

    // ========================================
    // UI MANAGEMENT
    // ========================================

    showModal() {
        if (!this.modal) return;
        
        this.modal.style.display = 'flex';
        this.modal.setAttribute('aria-hidden', 'false');
        
        // Focus first available race
        const firstAvailableRace = this.racesGrid.querySelector('.race-card:not(.taken)');
        if (firstAvailableRace) {
            firstAvailableRace.focus();
        }
        
        // Update initial status
        this.updateRaceStatus();
        
        // Disable body scroll
        document.body.style.overflow = 'hidden';
        
        console.log('🔍 Race Selection Modal geöffnet');
    }

    hideModal() {
        if (!this.modal) return;
        
        this.modal.style.display = 'none';
        this.modal.setAttribute('aria-hidden', 'true');
        
        // Re-enable body scroll
        document.body.style.overflow = '';
        
        console.log('❌ Race Selection Modal geschlossen');
    }

    isModalVisible() {
        return this.modal && this.modal.style.display === 'flex';
    }

    updateStatus(message) {
        if (this.statusDisplay) {
            this.statusDisplay.textContent = message;
        }
    }

    showError(message) {
        this.updateStatus(`❌ ${message}`);
        
        // Reset status after delay
        setTimeout(() => {
            if (this.selectedRaceId) {
                const race = FALLBACK_RACES.find(r => r.id === this.selectedRaceId);
                this.updateStatus(`✅ ${race.name} ausgewählt - Klicke "Bestätigen" um fortzufahren`);
            } else {
                this.updateStatus('Wähle eine Rasse aus den verfügbaren Optionen');
            }
        }, 3000);
    }

    enableConfirmButton() {
        this.confirmBtn.disabled = false;
        this.confirmBtn.textContent = '✅ Rasse bestätigen';
    }

    updatePlayerDisplay() {
        const raceDisplay = document.getElementById('raceDisplay');
        const playerName = document.getElementById('playerName');
        const goldAmount = document.getElementById('goldAmount');
        
        if (gameState.selectedRace) {
            if (raceDisplay) raceDisplay.textContent = gameState.selectedRace.icon;
            if (goldAmount) goldAmount.textContent = gameState.playerGold;
            
            if (gameState.currentPlayer && playerName) {
                playerName.textContent = `${gameState.currentPlayer.name} (${gameState.selectedRace.name})`;
            }
        }
    }

    // ========================================
    // SOUND EFFECTS
    // ========================================

    playSound(type) {
        // Simple sound effects using Web Audio API or HTML5 Audio
        if (!GAME_CONFIG.DEBUG_MODE) return;
        
        try {
            const sounds = {
                select: { frequency: 800, duration: 100 },
                confirm: { frequency: 1000, duration: 200 },
                error: { frequency: 300, duration: 500 }
            };
            
            const sound = sounds[type];
            if (!sound) return;
            
            this.playBeep(sound.frequency, sound.duration);
        } catch (error) {
            // Silent fail for sound effects
        }
    }

    playBeep(frequency, duration) {
        if (!window.AudioContext && !window.webkitAudioContext) return;
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
    }

    // ========================================
    // ACCESSIBILITY FEATURES
    // ========================================

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        announcement.style.width = '1px';
        announcement.style.height = '1px';
        announcement.style.overflow = 'hidden';
        
        document.body.appendChild(announcement);
        announcement.textContent = message;
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    // ========================================
    // DEBUG METHODS
    // ========================================

    getDebugInfo() {
        return {
            selectedRaceId: this.selectedRaceId,
            isProcessing: this.isProcessing,
            isModalVisible: this.isModalVisible(),
            availableRaces: FALLBACK_RACES.filter(race => !gameState.isRaceTaken(race.id)),
            takenRaces: gameState.getAllSelectedRaces()
        };
    }

    simulateRaceSelection(raceId) {
        if (GAME_CONFIG.DEBUG_MODE) {
            console.log('🧪 Simuliere Rassen-Auswahl:', raceId);
            this.selectRace(raceId);
            setTimeout(() => this.confirmRaceSelection(), 500);
        }
    }
}

// ========================================
// GLOBAL INSTANCE
// ========================================

let raceSelection = null;

// Initialize after DOM is ready
if (typeof window !== 'undefined') {
    window.RaceSelection = RaceSelection;
    
    document.addEventListener('DOMContentLoaded', () => {
        if (!raceSelection) {
            raceSelection = new RaceSelection();
            window.raceSelection = raceSelection;
        }
    });
}

console.log('✅ Race Selection System bereit');

// Export für Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RaceSelection };
}