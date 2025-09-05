// Chat queries
chat: {
    addMessage: async (gameId, playerName, message) => {
        const sql = 'INSERT INTO chat_messages (game_id, player_name, message) VALUES (?, ?, ?)';
        return db.query(sql, [gameId, playerName, message]);
    },

    getMessages: async (gameId, limit = 50) => {
        // ✅ FIX: Ensure both parameters are properly typed and validated
        const gameIdNum = parseInt(gameId);
        let limitNum = parseInt(limit);
        
        // Validate inputs
        if (isNaN(gameIdNum) || gameIdNum <= 0) {
            console.error('Invalid gameId for chat messages:', gameId);
            return [];
        }
        
        if (isNaN(limitNum) || limitNum <= 0) {
            limitNum = 50; // Default fallback
        }

        // ✅ IMPORTANT: Use direct values instead of parameters for LIMIT
        const sql = `
            SELECT * FROM chat_messages 
            WHERE game_id = ? 
            ORDER BY created_at DESC 
            LIMIT ${limitNum}
        `;
        
        try {
            console.log(`📝 Executing chat query: gameId=${gameIdNum}, limit=${limitNum}`);
            const results = await db.query(sql, [gameIdNum]);
            console.log(`✅ Chat query successful: ${results.length} messages retrieved`);
            return results.reverse(); // Return in chronological order
        } catch (error) {
            console.error('❌ Error fetching chat messages for game', gameIdNum, ':', error);
            return []; // Return empty array on error to prevent page crashes
        }
    }
}