// race-selection.js - Rassen-Auswahl System (Korrigiert)

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
        this.setupGameStateListeners();
        
        // Warte kurz und rendere dann die Rassen
        setTimeout(() => {
            this.renderRaces();
        }, 100);
        
        console.log('✅ Race Selection initialisiert');
    }

    setupEventListeners() {
        // Button Events
        if (this.confirmBtn) {
            this.confirmBtn.addEventListener('click', () => this.confirmRaceSelection());
        }
        
        // Keyboard Events
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Modal Close Events (verhindern während Race Selection)
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    e.preventDefault();
                }
            });
        }

        // Custom Events
        window.addEventListener('showRaceSelection', () => this.showModal());
        window.addEventListener('hideRaceSelection', () => this.hideModal());
        window.addEventListener('raceSelectionUpdate', (e) => this.handleRaceUpdate(e.detail));
        window.addEventListener('raceSelectionFailed', (e) => this.handleSelectionFailed(e.detail));
    }

    setupGameStateListeners() {
        if (!window.gameState) return;
        
        // Listen to game state changes
        gameState.on('otherPlayersRacesChanged', () => {
            this.updateRaceAvailability();
            this.updateRaceStatus();
        });

        gameState.on('gamePhaseChanged', (data) => {
            console.log('🔄 Game Phase geändert:', data.newValue);
            if (data.newValue === 'race_selection') {
                setTimeout(() => this.showModal(), 500);
            } else if (data.newValue === 'playing') {
                this.hideModal();
            }
        });
    }

    // ========================================
    // RACE RENDERING
    // ========================================

    renderRaces() {
        if (!this.racesGrid) {
            console.error('❌ Races Grid Element nicht gefunden');
            return;
        }
        
        this.racesGrid.innerHTML = '';
        
        // Verwende FALLBACK_RACES oder LOADED_RACES
        const availableRaces = window.LOADED_RACES || window.FALLBACK_RACES || [];
        
        if (availableRaces.length === 0) {
            console.error('❌ Keine Rassen verfügbar');
            this.racesGrid.innerHTML = '<div style="text-align: center; padding: 20px;">Keine Rassen verfügbar</div>';
            return;
        }
        
        availableRaces.forEach((race, index) => {
            const raceCard = this.createRaceCard(race, index);
            this.racesGrid.appendChild(raceCard);
        });
        
        this.updateRaceAvailability();
        console.log(`🏛️ ${availableRaces.length} Rassen gerendert`);
    }

    createRaceCard(race, index) {
        const card = document.createElement('div');
        card.className = 'race-card';
        card.dataset.raceId = race.id;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Rasse ${race.name} auswählen`);
        
        // Sichere Werte für alle Properties
        const safeName = race.name || 'Unbekannte Rasse';
        const safeIcon = race.icon || '👑';
        const safeColor = race.color || '#3498db';
        const safeDescription = race.description || 'Keine Beschreibung verfügbar';
        const safeSpecialAbility = race.specialAbility || 'Keine besonderen Fähigkeiten';
        const safeStartingGold = race.startingGold || 100;
        const safeUnits = race.units || [];
        
        card.innerHTML = `
            <div class="race-icon" style="color: ${safeColor}">${safeIcon}</div>
            <div class="race-name">${safeName}</div>
            <div class="race-description">${safeDescription}</div>
            <div class="race-special">
                <strong>Spezial:</strong> ${safeSpecialAbility}
            </div>
            <div class="race-stats">
                <div class="stat-item">
                    <span class="stat-label">Startgold:</span>
                    <span class="stat-value" style="color: #f1c40f;">💰 ${safeStartingGold}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Einheiten:</span>
                    <span class="stat-value">${safeUnits.length}</span>
                </div>
            </div>
            <div class="unit-grid">
                ${safeUnits.slice(0, 6).map(unit => `
                    <div class="unit-preview" title="${unit.name || 'Unbekannt'} - ${unit.cost || 0}💰">
                        <div class="unit-icon">${unit.icon || '❓'}</div>
                        <div class="unit-name">${unit.name || 'Unbekannt'}</div>
                        <div class="unit-cost">${unit.cost || 0}💰</div>
                    </div>
                `).join('')}
                ${safeUnits.length > 6 ? `
                    <div class="unit-preview more-units">
                        <div class="unit-icon">⋯</div>
                        <div class="unit-name">+${safeUnits.length - 6}</div>
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
        
        if (this.confirmBtn) {
            this.confirmBtn.disabled = false;
        }
        
        const availableRaces = window.LOADED_RACES || window.FALLBACK_RACES || [];
        const race = availableRaces.find(r => r.id === raceId);
        if (race) {
            this.updateStatus(`✅ ${race.name} ausgewählt - Klicke "Bestätigen" um fortzufahren`);
            
            // Update local game state
            if (window.gameState) {
                gameState.setSelectedRace(race);
            }
        }
        
        console.log('🏛️ Rasse ausgewählt:', raceId);
    }

    confirmRaceSelection() {
        if (!this.selectedRaceId || this.isProcessing) return;
        
        this.isProcessing = true;
        
        if (this.confirmBtn) {
            this.confirmBtn.disabled = true;
            this.confirmBtn.innerHTML = '<span class="loading-spinner"></span> Sende...';
        }
        
        const availableRaces = window.LOADED_RACES || window.FALLBACK_RACES || [];
        const race = availableRaces.find(r => r.id === this.selectedRaceId);
        
        if (!race) {
            this.handleSelectionFailed({ error: 'Rasse nicht gefunden' });
            return;
        }
        
        // Update local game state
        if (window.gameState) {
            gameState.setSelectedRace(race);
            gameState.updateState('raceConfirmed', true);
        }
        
        // Send to server via socket manager
        if (window.socketManager && window.socketManager.socket) {
            const gameSettings = window.gameState ? gameState.data.gameSettings : null;
            const currentPlayer = window.gameState ? gameState.currentPlayer : null;
            
            window.socketManager.socket.emit('select-race', {
                gameId: gameSettings?.gameId || 'demo-game',
                playerId: currentPlayer?.id || 'local',
                raceId: this.selectedRaceId
            });
        } else {
            // Demo mode oder kein Socket verfügbar
            console.log('🤖 Demo-Modus: Simuliere Rassen-Auswahl');
            setTimeout(() => this.simulateDemoRaceSelection(), 1000);
        }
        
        this.updateStatus('⏳ Warte auf andere Spieler...');
        
        console.log('✅ Rasse bestätigt:', race.name);
        
        // Dispatch event für Game Controller
        window.dispatchEvent(new CustomEvent('raceConfirmed', {
            detail: { race: race }
        }));
    }

    simulateDemoRaceSelection() {
        // Simuliere, dass andere Spieler Rassen wählen
        setTimeout(() => {
            this.hideModal();
            
            // Trigger game start
            if (window.gameState) {
                gameState.setGamePhase('playing');
            }
            
            // Dispatch event für Game Controller
            window.dispatchEvent(new CustomEvent('allRacesSelected', {
                detail: { message: 'Alle Rassen gewählt (Demo)' }
            }));
        }, 2000);
    }

    // ========================================
    // RACE AVAILABILITY MANAGEMENT
    // ========================================

    updateRaceAvailability() {
        if (!this.racesGrid || !window.gameState) return;
        
        this.racesGrid.querySelectorAll('.race-card').forEach(card => {
            const raceId = card.dataset.raceId;
            const isTaken = gameState.data.otherPlayersRaces.has(raceId);
            const isMySelection = this.selectedRaceId === raceId;
            
            if (isTaken && !isMySelection) {
                card.classList.add('taken');
                card.setAttribute('aria-disabled', 'true');
                
                const nameElement = card.querySelector('.race-name');
                if (nameElement && !nameElement.innerHTML.includes('(Vergeben)')) {
                    nameElement.innerHTML += ' <span style="color: #e74c3c; font-size: 0.8em;">(Vergeben)</span>';
                }
            } else {
                card.classList.remove('taken');
                card.setAttribute('aria-disabled', 'false');
                
                const nameElement = card.querySelector('.race-name');
                if (nameElement) {
                    nameElement.innerHTML = nameElement.innerHTML.replace(
                        / <span style="color: #e74c3c; font-size: 0.8em;">\(Vergeben\)<\/span>/, 
                        ''
                    );
                }
            }
        });
    }

    updateRaceStatus() {
        if (!window.gameState || gameState.gamePhase !== 'race_selection') return;
        
        const gameSettings = gameState.data.gameSettings;
        const totalPlayers = gameSettings?.players?.length || 2;
        const selectedCount = gameState.data.otherPlayersRaces.size;
        
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
    }

    handleKeyPress(e) {
        if (!this.isModalVisible()) return;
        
        // ESC to cancel (but only if not processing)
        if (e.key === 'Escape' && !this.isProcessing) {
            if (window.gameState && gameState.gamePhase === 'race_selection') {
                this.showError('Rassen-Auswahl ist erforderlich');
                return;
            }
            this.hideModal();
        }
        
        // Number keys for quick selection
        if (e.key >= '1' && e.key <= '9') {
            const index = parseInt(e.key) - 1;
            const availableRaces = window.LOADED_RACES || window.FALLBACK_RACES || [];
            if (index < availableRaces.length) {
                this.selectRace(availableRaces[index].id);
            }
        }
        
        // Enter to confirm
        if (e.key === 'Enter' && this.selectedRaceId && this.confirmBtn && !this.confirmBtn.disabled) {
            this.confirmRaceSelection();
        }
    }

    // ========================================
    // UI MANAGEMENT
    // ========================================

    showModal() {
        if (!this.modal) {
            console.error('❌ Race Selection Modal nicht gefunden');
            return;
        }
        
        console.log('🔍 Zeige Race Selection Modal');
        
        this.modal.style.display = 'flex';
        this.modal.setAttribute('aria-hidden', 'false');
        
        // Render races if not already done
        if (this.racesGrid && this.racesGrid.children.length === 0) {
            this.renderRaces();
        }
        
        // Focus first available race
        const firstAvailableRace = this.racesGrid.querySelector('.race-card:not(.taken)');
        if (firstAvailableRace) {
            firstAvailableRace.focus();
        }
        
        // Update initial status
        this.updateStatus('Wähle eine Rasse aus den verfügbaren Optionen');
        
        // Disable body scroll
        document.body.style.overflow = 'hidden';
    }

    hideModal() {
        if (!this.modal) return;
        
        console.log('❌ Verstecke Race Selection Modal');
        
        this.modal.style.display = 'none';
        this.modal.setAttribute('aria-hidden', 'true');
        
        // Re-enable body scroll
        document.body.style.overflow = '';
    }

    isModalVisible() {
        return this.modal && this.modal.style.display === 'flex';
    }

    updateStatus(message) {
        if (this.statusDisplay) {
            this.statusDisplay.textContent = message;
        }
        console.log('📢 Race Selection Status:', message);
    }

    showError(message) {
        this.updateStatus(`❌ ${message}`);
        
        // Reset status after delay
        setTimeout(() => {
            if (this.selectedRaceId) {
                const availableRaces = window.LOADED_RACES || window.FALLBACK_RACES || [];
                const race = availableRaces.find(r => r.id === this.selectedRaceId);
                if (race) {
                    this.updateStatus(`✅ ${race.name} ausgewählt - Klicke "Bestätigen" um fortzufahren`);
                }
            } else {
                this.updateStatus('Wähle eine Rasse aus den verfügbaren Optionen');
            }
        }, 3000);
    }

    enableConfirmButton() {
        if (this.confirmBtn) {
            this.confirmBtn.disabled = false;
            this.confirmBtn.textContent = '✅ Rasse bestätigen';
        }
    }

    // ========================================
    // PUBLIC API
    // ========================================

    show() {
        this.showModal();
    }

    hide() {
        this.hideModal();
    }

    isVisible() {
        return this.isModalVisible();
    }

    reset() {
        this.selectedRaceId = null;
        this.isProcessing = false;
        this.enableConfirmButton();
        this.racesGrid.querySelectorAll('.race-card').forEach(card => {
            card.classList.remove('selected', 'taken');
        });
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
            console.log('🏛️ Initialisiere Race Selection...');
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