class WasmInterface {
    constructor() {
        this.module = null;
        this.gameEngine = null;
    }
    
    async initialize() {
        if (typeof Module === 'undefined') {
            console.error("WASM Module not loaded!");
            return;
        }
        this.module = await Module();
        this.gameEngine = new this.module.GameEngine();
    }
    
    initGame(firstPlayerIndex) {
        this.gameEngine.initGame(firstPlayerIndex);
    }
    
    getGameState() {
        const json = this.gameEngine.getStateJSON();
        return JSON.parse(json);
    }
    
    executeAction(action) {
        // Use the new helper that accepts a JS object with integer enums
        // We need to ensure the action object is in the correct format (integers, arrays)
        // because human actions might use Embind objects (Enums, Vectors)
        
        const plainAction = { ...action };
        
        // Convert Enum object to integer
        if (typeof plainAction.type === 'object' && plainAction.type !== null) {
            plainAction.type = plainAction.type.value;
        }
        
        // Convert VectorGemColor to Array of integers
        if (plainAction.gems) {
            const gems = [];
            if (typeof plainAction.gems.size === 'function') {
                // It's a vector
                for(let i=0; i<plainAction.gems.size(); i++) {
                    const g = plainAction.gems.get(i);
                    gems.push(typeof g === 'object' ? g.value : g);
                }
            } else if (Array.isArray(plainAction.gems)) {
                // It's an array
                plainAction.gems.forEach(g => {
                    gems.push(typeof g === 'object' ? g.value : g);
                });
            }
            plainAction.gems = gems;
        }
        
        return this.gameEngine.executeActionFromJS(plainAction);
    }
    
    getLegalActions() {
        const json = this.gameEngine.getLegalActionsJSON();
        return JSON.parse(json);
    }
    
    
    isGameOver() {
        return this.gameEngine.isGameOver();
    }
    
    getWinner() {
        return this.gameEngine.getWinner();
    }
    
    isCurrentPlayerHuman() {
        return this.gameEngine.isCurrentPlayerHuman();
    }
    
    needsGemDiscard() {
        return this.gameEngine.needsGemDiscard();
    }
    
    getDiscardingPlayer() {
        return this.gameEngine.getDiscardingPlayer();
    }
    
    discardGem(playerId, gemColorValue) {
        return this.gameEngine.discardGem(playerId, gemColorValue);
    }
    
    // AI debug mode functions
    setAIDebugMode(enabled) {
        // This function will be used by the game controller to set debug mode
        // The actual AI engine is in the worker, so this is just a placeholder
        // The real implementation is in ai_worker_proxy.js
        console.log(`AI Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
    
}