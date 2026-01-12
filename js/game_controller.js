class GameController {
    constructor() {
        this.wasm = new WasmInterface();
        this.aiProxy = new AIWorkerProxy();
        this.ui = new UIManager();
        this.state = null;
        this.selectedGems = [];
        this.selectedCard = null;
        this.selectedCardTier = 0;
        this.selectedReservedCard = null;
        this.actionType = null; // 'TAKE_GEMS', 'RESERVE', 'PURCHASE'
        
        // Expose for global access (e.g. onclick handlers in generated HTML)
        window.gameController = this;
    }
    
    async init() {
        await this.wasm.initialize();
        await this.aiProxy.initialize();
        this.ui.init(this);
        
        // Show setup modal
        document.getElementById('setup-modal').style.display = 'flex';
    }
    
    startNewGame(firstPlayerIndex) {
        this.wasm.initGame(firstPlayerIndex);
        // AI difficulty is always HARD (50000)
        this.aiProxy.setDifficulty(50000000);
        
        // Set initial debug mode based on checkbox
        if (this.ui.elements.aiDebugCheck) {
            this.aiProxy.setDebugMode(this.ui.elements.aiDebugCheck.checked);
        }
        
        this.updateState();
        this.ui.render(this.state);
        this.checkAITurn();
    }
    
    setDebugMode(enabled) {
        this.aiProxy.setDebugMode(enabled);
    }
    
    setAIDebugMode(enabled) {
        this.aiProxy.setDebugMode(enabled);
    }
    
    updateState() {
        this.state = this.wasm.getGameState();
    }
    
    async executePlayerAction(action) {
        const success = this.wasm.executeAction(action);
        if (success) {
            this.updateState();
            this.clearSelection();
            this.ui.render(this.state);
            
            if (this.wasm.isGameOver()) {
                this.endGame();
            } else {
                await this.checkAITurn();
            }
        } else {
            alert("Invalid action!");
        }
        return success;
    }
    
    async checkAITurn() {
        while (!this.wasm.isCurrentPlayerHuman() && !this.wasm.isGameOver()) {
            await this.executeAITurn();
        }
    }
    
    async executeAITurn() {
        // Allow UI to update before starting AI computation
        await this.delay(50);
        
        // Use requestAnimationFrame to ensure UI is rendered
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        try {
            const action = await this.aiProxy.getAIAction(
                this.state,
                this.state.currentPlayerIndex
            );
            
            // Animate AI action
            // Note: action.type from worker is an integer, but ActionType enum values are objects in Embind.
            // We need to compare with the integer value of the enum.
            const typeInt = typeof action.type === 'object' ? action.type.value : action.type;
            
            if (typeInt === this.wasm.module.ActionType.TAKE_2_SAME.value ||
                typeInt === this.wasm.module.ActionType.TAKE_3_DIFFERENT.value) {
                const gems = [];
                // action.gems from worker is a plain array of integers
                if (Array.isArray(action.gems)) {
                    action.gems.forEach(g => gems.push(this.getGemColorString({value: g})));
                } else {
                    // Fallback if it's a vector (shouldn't happen with JSON)
                    for(let i=0; i<action.gems.size(); i++) gems.push(this.getGemColorString(action.gems.get(i)));
                }
                await this.ui.animateGems(gems, this.state.currentPlayerIndex);
            } else if (typeInt === this.wasm.module.ActionType.PURCHASE_CARD.value ||
                       typeInt === this.wasm.module.ActionType.RESERVE_CARD.value ||
                       typeInt === this.wasm.module.ActionType.PURCHASE_RESERVED.value) {
                await this.ui.animateCard(action.cardId, action.cardTier, this.state.currentPlayerIndex);
            }
            
            this.wasm.executeAction(action);
            this.updateState();
            this.ui.render(this.state);
            
            if (this.wasm.isGameOver()) {
                this.endGame();
            }
        } catch (error) {
            console.error('AI turn failed:', error);
            alert('Critical Error: AI computation failed. The game state might be inconsistent. Please start a new game.');
            // Optionally reset the game or show the setup modal
            document.getElementById('setup-modal').style.display = 'flex';
        }
    }
    
    // User interaction handlers
    onGemClick(color) {
        if (!this.isHumanTurn()) return;
        
        // Check if we already have this color selected
        const existingCount = this.selectedGems.filter(c => c === color).length;
        
        if (existingCount > 0) {
            // Toggle behavior: if already selected, deselect it
            // We do NOT auto-add a second gem on single click anymore (per user feedback)
            const index = this.selectedGems.indexOf(color);
            if (index >= 0) this.selectedGems.splice(index, 1);
        } else {
            // New color selection
            // If we already have 2 of the same color (from double click), clear selection first
            const counts = {};
            this.selectedGems.forEach(c => counts[c] = (counts[c] || 0) + 1);
            const hasTwoSame = Object.values(counts).some(c => c >= 2);
            
            if (hasTwoSame) {
                this.selectedGems = [color];
            } else {
                // Standard accumulation (up to 3 different)
                if (this.selectedGems.length < 3) {
                    this.selectedGems.push(color);
                }
            }
        }
        
        this.selectedCard = null;
        this.selectedReservedCard = null;
        this.actionType = 'TAKE_GEMS';
        this.ui.render(this.state); // Re-render to show selection
        this.checkInstantAction();
    }

    onGemDoubleClick(color) {
        if (!this.isHumanTurn()) return;

        // Check if there are enough gems in the pool (need at least 4 to take 2)
        const poolCount = this.state.gemPool[color.toLowerCase()];
        if (poolCount < 4) {
            // Visual feedback or just ignore?
            // Maybe just ensure single selection if not already selected
            if (!this.selectedGems.includes(color)) {
                this.onGemClick(color);
            }
            return;
        }

        // Set selection to exactly 2 of this color
        this.selectedGems = [color, color];
        
        this.selectedCard = null;
        this.selectedReservedCard = null;
        this.actionType = 'TAKE_GEMS';
        this.ui.render(this.state);
        this.checkInstantAction();
    }
    
    onCardClick(cardId, tier) {
        if (!this.isHumanTurn()) return;
        
        if (this.selectedCard && this.selectedCard.id === cardId) {
            this.selectedCard = null;
            this.actionType = null;
        } else {
            this.selectedCard = { id: cardId };
            this.selectedCardTier = tier;
            this.selectedReservedCard = null;
            this.selectedGems = [];
            this.actionType = 'CARD_SELECTED';
        }
        this.ui.render(this.state);
        this.checkInstantAction();
    }

    onDeckClick(tier) {
        if (!this.isHumanTurn()) return;

        // Check if player can reserve (max 3 reserved cards)
        const player = this.state.players[this.state.currentPlayerIndex];
        if (player.reservedCards.length >= 3) {
            alert("You cannot reserve more than 3 cards!");
            return;
        }

        if (this.selectedCard && this.selectedCard.id === -1 && this.selectedCardTier === tier) {
            this.selectedCard = null;
            this.actionType = null;
        } else {
            this.selectedCard = { id: -1 }; // -1 indicates deck
            this.selectedCardTier = tier;
            this.selectedReservedCard = null;
            this.selectedGems = [];
            this.actionType = 'DECK_SELECTED';
        }
        this.ui.render(this.state);
        this.checkInstantAction();
    }
    
    onReservedCardClick(cardId) {
        if (!this.isHumanTurn()) return;
        
        // Check if this is the current player's reserved card
        const player = this.state.players[this.state.currentPlayerIndex];
        const isOwnReserved = player.reservedCards.some(c => c.id === cardId);
        
        if (!isOwnReserved) return; // Cannot interact with opponent's reserved cards

        if (this.selectedReservedCard && this.selectedReservedCard.id === cardId) {
            this.selectedReservedCard = null;
            this.actionType = null;
        } else {
            this.selectedReservedCard = { id: cardId };
            this.selectedCard = null;
            this.selectedGems = [];
            this.actionType = 'RESERVED_SELECTED';
        }
        this.ui.render(this.state);
        this.checkInstantAction();
    }

    checkInstantAction() {
        if (this.ui.elements.instantActionCheck && this.ui.elements.instantActionCheck.checked) {
            if (this.isActionReady()) {
                this.onConfirmAction();
            }
        }
    }
    
    onConfirmAction() {
        if (!this.isHumanTurn()) return;
        
        let action = null;
        
        if (this.selectedGems.length > 0) {
            // Gem action
            // Check if 2 same or 3 different
            const counts = {};
            this.selectedGems.forEach(c => counts[c] = (counts[c] || 0) + 1);
            const unique = Object.keys(counts).length;
            
            if (unique === 1 && this.selectedGems.length === 2) {
                // Take 2 same
                const gemsVector = new this.wasm.module.VectorGemColor();
                this.mapColorsToEnum(this.selectedGems).forEach(g => gemsVector.push_back(g));
                
                action = {
                    type: this.wasm.module.ActionType.TAKE_2_SAME,
                    gems: gemsVector,
                    cardId: 0, cardTier: 0, fromReserved: false, payment: this.emptyPayment()
                };
            } else if (unique === 3 && this.selectedGems.length === 3) {
                // Take 3 different
                const gemsVector = new this.wasm.module.VectorGemColor();
                this.mapColorsToEnum(this.selectedGems).forEach(g => gemsVector.push_back(g));
                
                action = {
                    type: this.wasm.module.ActionType.TAKE_3_DIFFERENT,
                    gems: gemsVector,
                    cardId: 0, cardTier: 0, fromReserved: false, payment: this.emptyPayment()
                };
            }
        } else if (this.selectedCard) {
            if (this.selectedCard.id === -1) {
                // Reserve from deck
                const emptyGems = new this.wasm.module.VectorGemColor();
                action = {
                    type: this.wasm.module.ActionType.RESERVE_CARD,
                    gems: emptyGems,
                    cardId: -1,
                    cardTier: this.selectedCardTier,
                    fromReserved: false,
                    payment: this.emptyPayment()
                };
            } else {
                // Card action - Purchase or Reserve?
                const player = this.state.players[this.state.currentPlayerIndex];
                const card = this.findCard(this.selectedCard.id);
                
                if (this.canAfford(player, card)) {
                    const emptyGems = new this.wasm.module.VectorGemColor();
                    action = {
                        type: this.wasm.module.ActionType.PURCHASE_CARD,
                        gems: emptyGems,
                        cardId: this.selectedCard.id,
                        cardTier: this.selectedCardTier,
                        fromReserved: false,
                        payment: this.calculatePayment(player, card)
                    };
                } else {
                    // Reserve
                    const emptyGems = new this.wasm.module.VectorGemColor();
                    action = {
                        type: this.wasm.module.ActionType.RESERVE_CARD,
                        gems: emptyGems,
                        cardId: this.selectedCard.id,
                        cardTier: this.selectedCardTier,
                        fromReserved: false,
                        payment: this.emptyPayment()
                    };
                }
            }
        } else if (this.selectedReservedCard) {
            // Purchase reserved
            const player = this.state.players[this.state.currentPlayerIndex];
            const card = this.findReservedCard(player, this.selectedReservedCard.id);
            
            if (this.canAfford(player, card)) {
                const emptyGems = new this.wasm.module.VectorGemColor();
                action = {
                    type: this.wasm.module.ActionType.PURCHASE_RESERVED,
                    gems: emptyGems,
                    cardId: this.selectedReservedCard.id,
                    cardTier: card.tier,
                    fromReserved: true,
                    payment: this.calculatePayment(player, card)
                };
            }
        }
        
        if (action) {
            // Trigger animations before execution (or in parallel)
            // We need to know what action it is to animate correctly
            if (action.type === this.wasm.module.ActionType.TAKE_2_SAME ||
                action.type === this.wasm.module.ActionType.TAKE_3_DIFFERENT) {
                // Convert vector back to array for animation
                const gems = [];
                for(let i=0; i<action.gems.size(); i++) gems.push(this.getGemColorString(action.gems.get(i)));
                this.ui.animateGems(gems, this.state.currentPlayerIndex);
            } else if (action.type === this.wasm.module.ActionType.PURCHASE_CARD ||
                       action.type === this.wasm.module.ActionType.RESERVE_CARD ||
                       action.type === this.wasm.module.ActionType.PURCHASE_RESERVED) {
                this.ui.animateCard(action.cardId, action.cardTier, this.state.currentPlayerIndex);
            }

            this.executePlayerAction(action);
        }
    }

    getGemColorString(enumVal) {
        const map = {};
        map[this.wasm.module.GemColor.WHITE.value] = 'WHITE';
        map[this.wasm.module.GemColor.BLUE.value] = 'BLUE';
        map[this.wasm.module.GemColor.GREEN.value] = 'GREEN';
        map[this.wasm.module.GemColor.RED.value] = 'RED';
        map[this.wasm.module.GemColor.BLACK.value] = 'BLACK';
        map[this.wasm.module.GemColor.GOLD.value] = 'GOLD';
        return map[enumVal.value];
    }
    
    onCancelAction() {
        this.clearSelection();
        this.ui.render(this.state);
    }
    
    clearSelection() {
        this.selectedGems = [];
        this.selectedCard = null;
        this.selectedReservedCard = null;
        this.actionType = null;
    }
    
    endGame() {
        const winner = this.wasm.getWinner();
        this.ui.showGameOver(this.state, winner);
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    isHumanTurn() {
        return this.state && this.state.players[this.state.currentPlayerIndex].isHuman;
    }
    
    isActionReady() {
        if (this.selectedGems.length > 0) {
            // Check validity
            const counts = {};
            this.selectedGems.forEach(c => counts[c] = (counts[c] || 0) + 1);
            const unique = Object.keys(counts).length;
            if (unique === 1 && this.selectedGems.length === 2) return true;
            if (unique === 3 && this.selectedGems.length === 3) return true;
            return false;
        }
        if (this.selectedCard) return true; // Can always reserve if not affordable
        if (this.selectedReservedCard) {
            // Can only purchase if affordable
            const player = this.state.players[this.state.currentPlayerIndex];
            const card = this.findReservedCard(player, this.selectedReservedCard.id);
            return this.canAfford(player, card);
        }
        return false;
    }
    
    getActionDescription() {
        if (this.selectedGems.length > 0) return "Take Gems";
        if (this.selectedCard) {
            if (this.selectedCard.id === -1) return "Reserve from Deck";
            
            const player = this.state.players[this.state.currentPlayerIndex];
            const card = this.findCard(this.selectedCard.id);
            if (this.canAfford(player, card)) return "Purchase Card";
            return "Reserve Card";
        }
        if (this.selectedReservedCard) return "Purchase Reserved";
        return "";
    }
    
    // Helpers
    mapColorsToEnum(colors) {
        const map = {
            'WHITE': this.wasm.module.GemColor.WHITE,
            'BLUE': this.wasm.module.GemColor.BLUE,
            'GREEN': this.wasm.module.GemColor.GREEN,
            'RED': this.wasm.module.GemColor.RED,
            'BLACK': this.wasm.module.GemColor.BLACK,
            'GOLD': this.wasm.module.GemColor.GOLD
        };
        return colors.map(c => map[c]);
    }
    
    emptyPayment() {
        return { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
    }
    
    findCard(id) {
        for (let tier = 0; tier < 3; tier++) {
            const card = this.state.visibleCards[tier].find(c => c.id === id);
            if (card) return card;
        }
        return null;
    }
    
    findReservedCard(player, id) {
        return player.reservedCards.find(c => c.id === id);
    }
    
    canAfford(player, card) {
        // Simplified check, logic duplicated from C++ but needed for UI state
        // We can also ask WASM but that requires async or complex binding
        // Let's implement simple check here
        let goldNeeded = 0;
        const cost = card.cost;
        const gems = player.gems;
        const bonuses = player.bonuses;
        
        ['white', 'blue', 'green', 'red', 'black'].forEach(color => {
            const needed = Math.max(0, cost[color] - bonuses[color]);
            if (needed > gems[color]) {
                goldNeeded += (needed - gems[color]);
            }
        });
        
        return gems.gold >= goldNeeded;
    }
    
    calculatePayment(player, card) {
        // Logic to determine payment (gems + gold)
        const payment = this.emptyPayment();
        let goldNeeded = 0;
        const cost = card.cost;
        const gems = player.gems;
        const bonuses = player.bonuses;
        
        ['white', 'blue', 'green', 'red', 'black'].forEach(color => {
            const needed = Math.max(0, cost[color] - bonuses[color]);
            if (needed > 0) {
                if (gems[color] >= needed) {
                    payment[color] = needed;
                } else {
                    payment[color] = gems[color];
                    goldNeeded += (needed - gems[color]);
                }
            }
        });
        payment.gold = goldNeeded;
        return payment;
    }
}