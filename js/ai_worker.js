/**
 * AI Worker - Runs in separate thread
 * Handles AI computation without blocking main thread
 */

// Worker state
let wasmModule = null;
let aiEngine = null;
let isInitialized = false;
let currentDifficulty = 500000; // Default difficulty
let currentTimeLimit = 2.5; // Default time limit in seconds
let debugMode = false; // Debug mode flag

/**
 * Handle messages from main thread
 */
self.onmessage = async function(event) {
    const message = event.data;
    
    try {
        switch (message.type) {
            case 'INIT':
                await handleInit(message.wasmPath);
                break;
                
            case 'COMPUTE_AI_ACTION':
                await handleComputeAction(message);
                break;
                
            case 'SET_DIFFICULTY':
                handleSetDifficulty(message.difficulty);
                break;
                
            case 'SET_TIME_LIMIT':
                handleSetTimeLimit(message.timeLimit);
                break;
                
            case 'SET_DEBUG_MODE':
                handleSetDebugMode(message.enabled);
                break;
                
            default:
                console.warn('Unknown message type:', message.type);
        }
    } catch (error) {
        console.error('Worker error:', error);
        self.postMessage({
            type: 'AI_ERROR',
            id: message.id,
            error: error.message
        });
    }
};

/**
 * Initialize WASM module
 */
async function handleInit(wasmPath) {
    try {
        // Import WASM module script
        // Adjust path if needed. Assuming wasmPath is relative to web root (e.g. "wasm/splendor.js")
        // and worker is in "js/ai_worker.js".
        // We need to go up one level from js/ to web root.
        const scriptPath = '../' + wasmPath;
        importScripts(scriptPath);
        
        // Wait for Module to be available
        if (typeof Module === 'undefined') {
            throw new Error('Module not defined after import');
        }
        
        // Initialize module
        // We need to help Emscripten find the .wasm file since we are in a worker
        // and the script was imported from a different directory.
        
        // wasmPath is like "wasm/splendor.js"
        // We want to find the directory part, e.g. "wasm/"
        // And then prepend "../" because worker is in "js/"
        const lastSlash = wasmPath.lastIndexOf('/');
        const wasmDir = lastSlash >= 0 ? wasmPath.substring(0, lastSlash + 1) : '';
        const relativeWasmDir = '../' + wasmDir;

        wasmModule = await Module({
            locateFile: function(path, prefix) {
                if (path.endsWith('.wasm')) {
                    return relativeWasmDir + path;
                }
                return prefix + path;
            }
        });
        
        // Create AI engine with default difficulty
        aiEngine = new wasmModule.AIEngine(wasmModule.AIDifficulty.HARD);
        
        isInitialized = true;
        
        // Notify main thread
        self.postMessage({
            type: 'READY'
        });
        
        console.log('AI Worker initialized');
        
    } catch (error) {
        console.error('Failed to initialize AI Worker:', error);
        self.postMessage({
            type: 'ERROR',
            error: error.message
        });
    }
}

/**
 * Compute AI action
 */
async function handleComputeAction(message) {
    if (!isInitialized) {
        throw new Error('Worker not initialized');
    }
    
    const { id, gameState, playerId, difficulty, timeLimit } = message;
    
    try {
        // Update difficulty if changed
        if (difficulty && difficulty !== currentDifficulty) {
            handleSetDifficulty(difficulty);
        }
        
        // Update time limit if changed
        if (timeLimit && timeLimit !== currentTimeLimit) {
            handleSetTimeLimit(timeLimit);
        }
        
        const startTime = Date.now();
        
        console.log('[AI Worker] Starting AI computation with difficulty:', currentDifficulty, 'iterations, time limit:', currentTimeLimit, 'seconds');
        
        // Convert game state to JSON string
        const stateJSON = JSON.stringify(gameState);
        
        // Call AI engine
        // Note: This is the blocking computation that now runs in worker
        const actionJSON = debugMode ?
            aiEngine.selectActionJSONDebug(stateJSON, playerId) :
            aiEngine.selectActionJSON(stateJSON, playerId);
        
        const endTime = Date.now();
        const timeMs = endTime - startTime;
        
        // Parse action
        const action = JSON.parse(actionJSON);
        
        // Get actual iterations
        const actualIterations = aiEngine.getLastIterationCount();
        
        console.log('[AI Worker] AI computation completed:', actualIterations, 'iterations in', timeMs, 'ms');

        // Send result back to main thread
        self.postMessage({
            type: 'AI_ACTION_RESULT',
            id: id,
            action: action,
            stats: {
                iterations: actualIterations,
                timeMs: timeMs
            }
        });
        
    } catch (error) {
        console.error('AI computation error:', error);
        self.postMessage({
            type: 'AI_ERROR',
            id: id,
            error: error.message
        });
    }
}

/**
 * Set AI difficulty
 */
function handleSetDifficulty(difficulty) {
    if (!isInitialized) {
        return;
    }
    
    currentDifficulty = difficulty;
    
    console.log('[AI Worker] Setting difficulty to:', difficulty);
    
    // Map to enum
    let diffEnum;
    if (difficulty <= 100) {
        diffEnum = wasmModule.AIDifficulty.EASY;
        console.log('[AI Worker] Mapped to EASY (1000 iterations)');
    } else if (difficulty <= 1000) {
        diffEnum = wasmModule.AIDifficulty.MEDIUM;
        console.log('[AI Worker] Mapped to MEDIUM (10000 iterations)');
    } else {
        diffEnum = wasmModule.AIDifficulty.HARD;
        console.log('[AI Worker] Mapped to HARD (50000 iterations)');
    }
    
    aiEngine.setDifficulty(diffEnum);
    
    // CRITICAL: Also set the iteration limit directly to override the enum
    console.log('[AI Worker] Setting iteration limit directly to:', difficulty);
    aiEngine.setIterationLimit(difficulty);
}

/**
 * Set AI time limit
 */
function handleSetTimeLimit(timeLimit) {
    if (!isInitialized) {
        return;
    }
    
    currentTimeLimit = timeLimit;
    console.log('[AI Worker] Setting time limit to:', timeLimit, 'seconds');
    // Convert seconds to milliseconds for C++ engine
    const timeLimitMs = Math.round(timeLimit * 1000);
    console.log('[AI Worker] Time limit in milliseconds:', timeLimitMs);
    aiEngine.setTimeLimit(timeLimitMs);
}

/**
 * Set debug mode
 */
function handleSetDebugMode(enabled) {
    if (!isInitialized) {
        return;
    }
    
    debugMode = enabled;
    aiEngine.setDebugMode(enabled);
}

/**
 * Send progress update (optional enhancement)
 */
function sendProgress(id, progress) {
    self.postMessage({
        type: 'PROGRESS',
        id: id,
        progress: progress
    });
}