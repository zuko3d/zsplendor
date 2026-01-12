document.addEventListener('DOMContentLoaded', () => {
    const controller = new GameController();
    controller.init().catch(err => {
        console.error("Failed to initialize game:", err);
        document.getElementById('status-message').textContent = "Error loading game engine. Please check console.";
        document.getElementById('status-message').style.color = "red";
    });
    
    // Expose debug mode function globally for easy access in console
    window.enableAIDebug = function(enabled = true) {
        controller.setAIDebugMode(enabled);
        console.log(`AI debug mode ${enabled ? 'enabled' : 'disabled'}`);
    };
    
    // Log instructions
    console.log("AI Debug Mode: Call enableAIDebug() in console to enable AI debugging");
});