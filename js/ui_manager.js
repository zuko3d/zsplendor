class UIManager {
    constructor() {
        this.controller = null;
        this.elements = {};
        this.gemColors = ['WHITE', 'BLUE', 'GREEN', 'RED', 'BLACK', 'GOLD'];
        this.aiTimerInterval = null;
        this.aiTimerStartTime = null;
    }
    
    init(controller) {
        this.controller = controller;
        this.cacheElements();
        this.attachEventListeners();
    }
    
    cacheElements() {
        this.elements = {
            turnInfo: document.getElementById('turn-info'),
            currentPlayer: document.getElementById('current-player'),
            statusMessage: document.getElementById('status-message'),
            noblesArea: document.getElementById('nobles-area'),
            tier1Cards: document.getElementById('tier1-cards'),
            tier2Cards: document.getElementById('tier2-cards'),
            tier3Cards: document.getElementById('tier3-cards'),
            gemPool: document.getElementById('gem-pool'),
            playersArea: document.getElementById('players-area'),
            actionPanel: document.getElementById('action-panel'),
            confirmBtn: document.getElementById('confirm-action-btn'),
            cancelBtn: document.getElementById('cancel-action-btn'),
            unwindBtn: document.getElementById('unwind-btn'),
            setupModal: document.getElementById('setup-modal'),
            gameOverModal: document.getElementById('game-over-modal'),
            winnerDisplay: document.getElementById('winner-display'),
            startGameBtn: document.getElementById('start-game-btn'),
            playAgainBtn: document.getElementById('play-again-btn'),
            firstPlayerSelect: document.getElementById('first-player'),
            aiTimeLimitInput: document.getElementById('ai-time-limit'),
            aiDifficultyInput: document.getElementById('ai-difficulty'),
            aiThinkingIndicator: document.getElementById('ai-thinking-indicator'),
            aiTimer: document.querySelector('.ai-timer'),
            instantActionCheck: document.getElementById('instant-action-check'),
            aiDebugCheck: document.getElementById('debug-mode-check')
        };
    }
    
    attachEventListeners() {
        // Gem clicks
        const gemStacks = document.querySelectorAll('.gem-stack');
        gemStacks.forEach(stack => {
            stack.addEventListener('click', () => {
                const color = stack.getAttribute('data-color');
                if (color === 'GOLD') return; // Gold is not clickable directly
                this.controller.onGemClick(color);
            });
            
            stack.addEventListener('dblclick', (e) => {
                e.preventDefault();
                const color = stack.getAttribute('data-color');
                if (color === 'GOLD') return;
                this.controller.onGemDoubleClick(color);
            });
        });
        
        // Action buttons
        this.elements.confirmBtn.addEventListener('click', () => this.controller.onConfirmAction());
        this.elements.cancelBtn.addEventListener('click', () => this.controller.onCancelAction());
        this.elements.unwindBtn.addEventListener('click', () => this.controller.unwindAction());
        
        // Modal buttons
        this.elements.startGameBtn.addEventListener('click', () => {
            console.log("Start Game clicked");
            // Direct DOM access to avoid any caching issues
            const select = document.getElementById('first-player');
            const timeLimitInput = document.getElementById('ai-time-limit');
            const difficultyInput = document.getElementById('ai-difficulty');
            
            if (select) {
                const firstPlayerIndex = parseInt(select.value);
                const aiTimeLimit = timeLimitInput ? parseFloat(timeLimitInput.value) : 2.5;
                const aiDifficulty = difficultyInput ? parseInt(difficultyInput.value) : 5000000;
                
                console.log("Starting game with first player index:", firstPlayerIndex);
                console.log("AI Time Limit:", aiTimeLimit, "seconds");
                console.log("AI Difficulty:", aiDifficulty, "iterations");
                
                this.elements.setupModal.style.display = 'none';
                this.controller.startNewGame(firstPlayerIndex, aiTimeLimit, aiDifficulty);
            } else {
                console.error("CRITICAL: 'first-player' select element not found!");
                // Fallback to default (Human starts)
                this.elements.setupModal.style.display = 'none';
                this.controller.startNewGame(0, 2.5, 5000000);
            }
        });
        
        this.elements.playAgainBtn.addEventListener('click', () => {
            this.elements.gameOverModal.style.display = 'none';
            this.elements.setupModal.style.display = 'flex';
        });

        // AI Debug mode checkbox
        if (this.elements.aiDebugCheck) {
            this.elements.aiDebugCheck.addEventListener('change', (e) => {
                this.controller.setAIDebugMode(e.target.checked);
            });
        }

        // Event delegation for reserved cards in player panels
        this.elements.playersArea.addEventListener('click', (e) => {
            if (e.target.classList.contains('reserved-card-mini')) {
                const id = parseInt(e.target.getAttribute('data-id'));
                this.controller.onReservedCardClick(id);
            }
        });
    }
    
    render(state) {
        this.updateHeader(state);
        this.renderGemPool(state.gemPool);
        this.renderNobles(state.nobles);
        this.renderCards(state.visibleCards, state.decks); // Pass decks info if available in state (it is)
        this.renderPlayers(state.players, state.currentPlayerIndex);
        this.updateActionPanel(state);
    }
    
    updateHeader(state) {
        this.elements.turnInfo.textContent = `Turn: ${state.turnNumber}`;
        const currentPlayer = state.players[state.currentPlayerIndex];
        this.elements.currentPlayer.textContent = `Current Player: ${currentPlayer.name}`;
        
        if (currentPlayer.isHuman) {
            this.elements.statusMessage.textContent = "Your turn! Select an action.";
            this.elements.statusMessage.style.color = "#2ecc71";
            this.setAIThinking(false);
        } else {
            this.elements.statusMessage.textContent = "AI is thinking...";
            this.elements.statusMessage.style.color = "#f39c12";
            this.setAIThinking(true);
        }
    }

    setAIThinking(isThinking) {
        if (isThinking) {
            this.elements.aiThinkingIndicator.classList.remove('hidden');
            this.startAITimer();
        } else {
            this.elements.aiThinkingIndicator.classList.add('hidden');
            this.stopAITimer();
        }
    }
    
    startAITimer() {
        this.aiTimerStartTime = Date.now();
        this.updateAITimer();
        this.aiTimerInterval = setInterval(() => this.updateAITimer(), 100);
    }
    
    stopAITimer() {
        if (this.aiTimerInterval) {
            clearInterval(this.aiTimerInterval);
            this.aiTimerInterval = null;
        }
        this.aiTimerStartTime = null;
    }
    
    updateAITimer() {
        if (!this.aiTimerStartTime || !this.elements.aiTimer) return;
        
        const elapsed = Date.now() - this.aiTimerStartTime;
        const seconds = Math.floor(elapsed / 1000);
        const deciseconds = Math.floor((elapsed % 1000) / 100);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        const formattedTime = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}.${deciseconds}`;
        this.elements.aiTimer.textContent = formattedTime;
    }
    
    renderGemPool(gemPool) {
        const stacks = this.elements.gemPool.querySelectorAll('.gem-stack');
        stacks.forEach(stack => {
            const color = stack.getAttribute('data-color');
            const countSpan = stack.querySelector('.count');
            const count = gemPool[color.toLowerCase()];
            countSpan.textContent = count;
            
            if (count === 0) {
                stack.style.opacity = '0.5';
                stack.style.cursor = 'default';
            } else {
                stack.style.opacity = '1';
                stack.style.cursor = 'pointer';
            }
            
            // Highlight selected gems
            if (this.controller.selectedGems.includes(color)) {
                stack.classList.add('selected');
            } else {
                stack.classList.remove('selected');
            }
        });
    }
    
    renderNobles(nobles) {
        this.elements.noblesArea.innerHTML = '';
        nobles.forEach(noble => {
            const el = document.createElement('div');
            el.className = 'noble';
            el.innerHTML = `
                <div class="noble-points">${noble.points}</div>
                <div class="noble-reqs">
                    ${this.renderGemReqs(noble.requirements)}
                </div>
            `;
            this.elements.noblesArea.appendChild(el);
        });
    }
    
    renderGemReqs(reqs) {
        let html = '';
        for (const [color, count] of Object.entries(reqs)) {
            if (count > 0 && color !== 'gold') {
                html += `
                    <div class="req-item">
                        <div class="req-color" style="background-color: ${this.getColorHex(color)}"></div>
                        <span>${count}</span>
                    </div>
                `;
            }
        }
        return html;
    }
    
    getColorHex(color) {
        const map = {
            'white': '#ffffff',
            'blue': '#3498db',
            'green': '#2ecc71',
            'red': '#e74c3c',
            'black': '#34495e',
            'gold': '#f1c40f'
        };
        return map[color.toLowerCase()] || '#000';
    }
    
    renderCards(visibleCards, decks) {
        // visibleCards is array of arrays [tier1, tier2, tier3]
        // decks is array of arrays of cards [deck1, deck2, deck3]
        
        // Get current player info for hover effects
        const currentPlayerIndex = this.controller.state.currentPlayerIndex;
        const currentPlayer = this.controller.state.players[currentPlayerIndex];
        
        this.renderTier(this.elements.tier3Cards, visibleCards[2], 3, decks[2], currentPlayer);
        this.renderTier(this.elements.tier2Cards, visibleCards[1], 2, decks[1], currentPlayer);
        this.renderTier(this.elements.tier1Cards, visibleCards[0], 1, decks[0], currentPlayer);
    }
    
    renderTier(container, cards, tier, deck, currentPlayer) {
        container.innerHTML = '';
        
        // Render Deck
        const deckEl = document.createElement('div');
        deckEl.className = `card deck tier-${tier}`;
        
        // Check if deck is selected
        if (this.controller.selectedCard && this.controller.selectedCard.id === -1 && this.controller.selectedCardTier === tier) {
            deckEl.classList.add('selected');
        }

        const deckCount = Array.isArray(deck) ? deck.length : deck;

        if (deckCount > 0) {
            deckEl.innerHTML = `
                <div class="deck-content">
                    <div class="deck-label">Tier ${tier}</div>
                    <div class="deck-count">${deckCount}</div>
                </div>
            `;
            deckEl.addEventListener('click', () => this.controller.onDeckClick(tier));
            
            // Deck hover effect (can reserve?)
            if (currentPlayer && currentPlayer.isHuman) {
                if (currentPlayer.reservedCards.length < 3) {
                    deckEl.classList.add('can-reserve');
                } else {
                    deckEl.classList.add('cannot-act');
                }
            }
        } else {
            deckEl.classList.add('empty');
            deckEl.innerHTML = '<div class="deck-label">Empty</div>';
        }
        container.appendChild(deckEl);
        
        // Render Visible Cards
        cards.forEach(card => {
            const el = this.createCardElement(card, tier, false, currentPlayer);
            container.appendChild(el);
        });
    }

    createCardElement(card, tier, isReserved = false, currentPlayer = null) {
        const el = document.createElement('div');
        el.className = `card tier-${tier}`;
        
        // Check selection
        if (isReserved) {
            if (this.controller.selectedReservedCard && this.controller.selectedReservedCard.id === card.id) {
                el.classList.add('selected');
            }
            el.classList.add('reserved-card-full');
        } else {
            if (this.controller.selectedCard && this.controller.selectedCard.id === card.id) {
                el.classList.add('selected');
            }
        }
        
        // Add hover effects
        if (currentPlayer && currentPlayer.isHuman) {
            const canAfford = this.controller.canAfford(currentPlayer, card);
            
            if (isReserved) {
                // Reserved cards: can only purchase
                if (canAfford) {
                    el.classList.add('can-purchase');
                } else {
                    el.classList.add('cannot-act');
                }
            } else {
                // Board cards: purchase or reserve
                if (canAfford) {
                    el.classList.add('can-purchase');
                } else if (currentPlayer.reservedCards.length < 3) {
                    el.classList.add('can-reserve');
                } else {
                    el.classList.add('cannot-act');
                }
            }
        }

        el.setAttribute('data-card-id', card.id);
        el.innerHTML = `
            <div class="card-header">
                <div class="card-points">${card.points || ''}</div>
                <div class="card-bonus" style="background-color: ${this.getColorHex(card.bonus)}"></div>
            </div>
            <div class="card-cost">
                ${this.renderCost(card.cost)}
            </div>
        `;
        
        if (isReserved) {
            el.addEventListener('click', () => this.controller.onReservedCardClick(card.id));
        } else {
            el.addEventListener('click', () => this.controller.onCardClick(card.id, tier));
        }
        
        return el;
    }
    
    renderCost(cost) {
        let html = '';
        for (const [color, count] of Object.entries(cost)) {
            if (count > 0) {
                html += `
                    <div class="cost-item">
                        <div class="cost-circle" style="background-color: ${this.getColorHex(color)}"></div>
                        <span>${count}</span>
                    </div>
                `;
            }
        }
        return html;
    }
    
    renderPlayers(players, currentIndex) {
        this.elements.playersArea.innerHTML = '';
        players.forEach((player, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = `player-wrapper ${player.isHuman ? 'human' : 'ai'}`;
            
            const panel = this.createPlayerPanel(player, index === currentIndex);
            const reserved = this.createReservedSection(player);
            
            if (player.isHuman) {
                wrapper.appendChild(reserved);
                wrapper.appendChild(panel);
            } else {
                wrapper.appendChild(panel);
                wrapper.appendChild(reserved);
            }
            
            this.elements.playersArea.appendChild(wrapper);
        });
    }

    createPlayerPanel(player, isActive) {
        const el = document.createElement('div');
        el.className = `player-panel ${isActive ? 'active' : ''}`;
        el.setAttribute('data-player-id', player.id);
        
        el.innerHTML = `
            <div class="player-header">
                <div class="player-name">${player.name} ${player.isHuman ? '(You)' : '(AI)'}</div>
                <div class="player-points">${player.points} VP</div>
            </div>
            <div class="player-resources">
                ${this.renderResourceRow('white', player.gems.white, player.bonuses.white)}
                ${this.renderResourceRow('blue', player.gems.blue, player.bonuses.blue)}
                ${this.renderResourceRow('green', player.gems.green, player.bonuses.green)}
                ${this.renderResourceRow('red', player.gems.red, player.bonuses.red)}
                ${this.renderResourceRow('black', player.gems.black, player.bonuses.black)}
                ${this.renderResourceRow('gold', player.gems.gold, 0)}
            </div>
            
            <div class="nobles-collection">
                ${player.nobles.map(n => `<div class="mini-noble"></div>`).join('')}
            </div>
        `;
        return el;
    }

    createReservedSection(player) {
        const container = document.createElement('div');
        container.className = `reserved-container ${player.isHuman ? 'left' : 'right'}`;
        
        if (player.reservedCards.length === 0) {
            container.innerHTML = '<div class="reserved-placeholder">No reserved cards</div>';
            return container;
        }

        // Pass current player for hover logic if it's the human player's reserved cards
        // Actually, we only want hover effects if it's the human player's turn and they are looking at their own cards
        const currentPlayerIndex = this.controller.state.currentPlayerIndex;
        const currentPlayer = this.controller.state.players[currentPlayerIndex];
        const isOwnCards = currentPlayer.id === player.id;

        player.reservedCards.forEach(card => {
            // Only pass currentPlayer if these are their own cards, otherwise no hover effect (or maybe red?)
            // Requirement says "Draw reserved cards... No need to grey-out player's reserved card"
            // Logic: If it's my turn and these are my cards, show purchase status.
            // If it's my turn and these are opponent cards, show nothing or red?
            // Let's stick to: if it's human player's reserved cards, show status.
            
            const cardEl = this.createCardElement(card, card.tier, true, isOwnCards ? currentPlayer : null);
            container.appendChild(cardEl);
        });

        return container;
    }
    
    updateActionPanel(state) {
        const currentPlayer = state.players[state.currentPlayerIndex];
        if (!currentPlayer.isHuman) {
            this.elements.confirmBtn.disabled = true;
            this.elements.cancelBtn.disabled = true;
            return;
        }
        
        // Enable confirm if action is ready
        if (this.controller.isActionReady()) {
            this.elements.confirmBtn.disabled = false;
            this.elements.confirmBtn.textContent = this.controller.getActionDescription();
        } else {
            this.elements.confirmBtn.disabled = true;
            this.elements.confirmBtn.textContent = "Select Action";
        }
        
        this.elements.cancelBtn.disabled = false;
    }
    
    showGameOver(state, winnerId) {
        const winner = state.players.find(p => p.id === winnerId);
        this.elements.winnerDisplay.textContent = `${winner.name} wins with ${winner.points} points!`;
        this.elements.gameOverModal.style.display = 'flex';
    }

    renderResourceRow(color, gemCount, bonusCount) {
        let gemsHtml = '';
        for (let i = 0; i < gemCount; i++) {
            gemsHtml += `<div class="mini-gem" style="background-color: ${this.getColorHex(color)}"></div>`;
        }
        
        // If too many gems, fallback to number
        if (gemCount > 5) {
            gemsHtml = `<div class="mini-gem" style="background-color: ${this.getColorHex(color)}"></div> x${gemCount}`;
        }

        let bonusHtml = '';
        if (color !== 'gold') {
            for (let i = 0; i < bonusCount; i++) {
                bonusHtml += `<div class="mini-card" style="background-color: ${this.getColorHex(color)}"></div>`;
            }
            // If too many bonuses, fallback to number
            if (bonusCount > 5) {
                bonusHtml = `<div class="mini-card" style="background-color: ${this.getColorHex(color)}"></div> x${bonusCount}`;
            }
        }

        return `
            <div class="resource-row">
                <div class="resource-item gems-container">${gemsHtml}</div>
                ${color !== 'gold' ? `<div class="resource-item bonus-container">${bonusHtml}</div>` : '<div class="resource-item"></div>'}
            </div>
        `;
    }

    async animateGems(gems, playerId) {
        const playerPanel = document.querySelector(`.player-panel[data-player-id="${playerId}"]`);
        if (!playerPanel) return;

        const promises = gems.map(color => {
            return new Promise(resolve => {
                const sourceStack = document.querySelector(`.gem-stack[data-color="${color}"]`);
                if (!sourceStack) { resolve(); return; }

                const rect = sourceStack.getBoundingClientRect();
                const targetRect = playerPanel.getBoundingClientRect();

                const flyingGem = document.createElement('div');
                flyingGem.className = 'flying-element flying-gem';
                flyingGem.style.backgroundColor = this.getColorHex(color);
                flyingGem.style.left = `${rect.left + rect.width / 2 - 15}px`;
                flyingGem.style.top = `${rect.top + rect.height / 2 - 15}px`;
                
                document.body.appendChild(flyingGem);

                // Force reflow
                flyingGem.offsetHeight;

                flyingGem.style.left = `${targetRect.left + targetRect.width / 2}px`;
                flyingGem.style.top = `${targetRect.top + targetRect.height / 2}px`;
                flyingGem.style.opacity = '0';

                setTimeout(() => {
                    document.body.removeChild(flyingGem);
                    resolve();
                }, 500);
            });
        });

        await Promise.all(promises);
    }

    async animateCard(cardId, tier, playerId) {
        const playerPanel = document.querySelector(`.player-panel[data-player-id="${playerId}"]`);
        if (!playerPanel) return;

        // Find the card element. It might be in a tier row or reserved section (if purchasing reserved)
        // We need a way to identify the card element. Let's assume we can find it by some attribute or just use the tier container as approximation if specific card not found easily without ID on element
        // Let's add ID to card elements in render
        
        // For now, let's try to find by a data attribute we should add
        let sourceEl = document.querySelector(`.card[data-card-id="${cardId}"]`);
        if (!sourceEl) {
            // Try reserved
            sourceEl = document.querySelector(`.reserved-card-mini[data-id="${cardId}"]`);
        }
        
        if (!sourceEl) return; // Can't animate if not found

        const rect = sourceEl.getBoundingClientRect();
        const targetRect = playerPanel.getBoundingClientRect();

        const flyingCard = document.createElement('div');
        flyingCard.className = 'flying-element flying-card';
        flyingCard.style.left = `${rect.left}px`;
        flyingCard.style.top = `${rect.top}px`;
        flyingCard.style.width = `${rect.width}px`;
        flyingCard.style.height = `${rect.height}px`;
        // Copy background/style if possible, or just generic card look
        flyingCard.style.backgroundColor = '#ecf0f1';
        
        document.body.appendChild(flyingCard);

        // Force reflow
        flyingCard.offsetHeight;

        flyingCard.style.left = `${targetRect.left + targetRect.width / 2 - rect.width/2}px`;
        flyingCard.style.top = `${targetRect.top + targetRect.height / 2 - rect.height/2}px`;
        flyingCard.style.opacity = '0';
        flyingCard.style.transform = 'scale(0.2)';

        return new Promise(resolve => {
            setTimeout(() => {
                document.body.removeChild(flyingCard);
                resolve();
            }, 800);
        });
    }
    
    updateUnwindButton(canUnwind) {
        if (this.elements.unwindBtn) {
            this.elements.unwindBtn.disabled = !canUnwind;
        }
    }
}