/* Lobby page specific styles */

.game-info {
    text-align: center;
    margin-top: 1rem;
}

.game-title {
    font-size: 1.8rem;
    font-weight: 600;
    color: white;
    margin-bottom: 0.5rem;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.game-subtitle {
    font-size: 1.1rem;
    color: rgba(255, 255, 255, 0.9);
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
}

/* Lobby content layout */
.lobby-content {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 2rem;
    margin-bottom: 2rem;
}

.players-section,
.chat-section {
    display: flex;
    flex-direction: column;
}

/* Players list */
.players-list {
    min-height: 200px;
    margin-bottom: 2rem;
}

.player-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    margin-bottom: 0.5rem;
    background: #f8f9fa;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    transition: all 0.3s ease;
}

.player-item.ready {
    border-color: #4CAF50;
    background: #f1f8e9;
}

.player-item.host {
    border-color: #FF9800;
    background: #fff3e0;
}

.player-item.current-player {
    border-color: #2196F3;
    background: #e3f2fd;
    box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);
}

.player-info {
    display: flex;
    align-items: center;
    gap: 0.8rem;
}

.player-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    color: white;
    font-weight: 600;
}

.player-icon.host {
    background: #FF9800;
}

.player-icon.ready {
    background: #4CAF50;
}

.player-icon.not-ready {
    background: #757575;
}

.player-name {
    font-weight: 600;
    font-size: 1.1rem;
    color: #333;
}

.player-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.status-badge {
    padding: 0.3rem 0.8rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
}

.status-badge.host {
    background: #FF9800;
    color: white;
}

.status-badge.ready {
    background: #4CAF50;
    color: white;
}

.status-badge.not-ready {
    background: #757575;
    color: white;
}

/* Lobby actions */
.lobby-actions {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
}

.lobby-actions .btn {
    flex: 1;
}

/* Host controls */
.host-controls {
    padding-top: 1rem;
}

.host-controls hr {
    border: none;
    border-top: 1px solid #eee;
    margin-bottom: 1rem;
}

.host-controls h3 {
    color: #333;
    margin-bottom: 1rem;
    font-size: 1.2rem;
}

.host-info {
    margin-top: 0.5rem;
    font-size: 0.9rem;
    color: #666;
    line-height: 1.4;
}

#start-game {
    width: 100%;
    margin-bottom: 0.5rem;
}

/* Ready toggle states */
#ready-toggle.ready {
    background: #f44336;
    color: white;
}

#ready-toggle.ready:hover {
    background: #d32f2f;
}

#ready-toggle:not(.ready) {
    background: #4CAF50;
    color: white;
}

#ready-toggle:not(.ready):hover {
    background: #45a049;
}

/* Chat specific styles for lobby */
.chat-section .card {
    height: 500px;
    padding: 0;
}

.chat-container {
    height: 100%;
}

/* Loading overlay */
.loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.loading-content {
    text-align: center;
    color: white;
}

.loading-content .spinner {
    width: 50px;
    height: 50px;
    border-width: 4px;
    margin: 0 auto 1rem;
}

.loading-content div {
    font-size: 1.2rem;
    margin-top: 1rem;
}

/* Modal styles for lobby */
.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
}

/* Animation for ready status changes */
.player-item {
    animation: statusChange 0.5s ease;
}

@keyframes statusChange {
    0% { transform: scale(1); }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); }
}

/* Pulse animation for waiting states */
.waiting-pulse {
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.7; }
    100% { opacity: 1; }
}

/* Responsive design for lobby */
@media (max-width: 968px) {
    .lobby-content {
        grid-template-columns: 1fr;
        gap: 1.5rem;
    }
    
    .chat-section .card {
        height: 400px;
    }
}

@media (max-width: 600px) {
    .lobby-actions {
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .lobby-actions .btn {
        width: 100%;
    }
    
    .player-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }
    
    .player-status {
        align-self: flex-end;
    }
    
    .player-info {
        width: 100%;
    }
}