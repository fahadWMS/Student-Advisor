/**
 * Tool System - Central Export
 * Provides unified access to all tools and registry functions
 */

// Export types
export * from "./types";

// Export registry
export * from "./registry";
export { default as toolRegistry } from "./registry";

// Export tools
export { ragTool, multiNamespaceRagTool } from "./ragTool";
export { calculatorTool } from "./calculatorTool";

// Import tools for auto-registration
import toolRegistry from "./registry";
import { ragTool, multiNamespaceRagTool } from "./ragTool";
import { calculatorTool } from "./calculatorTool";

/**
 * Auto-register all tools
 * This happens when the module is imported
 */
function registerDefaultTools() {
  console.log("🔧 Registering default tools...");

  // Register RAG tools
  toolRegistry.register(ragTool);
  toolRegistry.register(multiNamespaceRagTool);

  // Register calculator tool
  toolRegistry.register(calculatorTool);

  const stats = toolRegistry.getStats();
  console.log(`✅ Registered ${stats.totalTools} tools`);
  console.log("  Capabilities:", Object.keys(stats.toolsByCapability).join(", "));
  console.log("  Personas:", Object.keys(stats.toolsByPersona).join(", "));
}

// Auto-register on import
registerDefaultTools();

/**
 * Convenience function to get all registered tool names
 */
export function getAvailableTools() {
  return toolRegistry.getToolNames();
}

/**
 * Convenience function to search tools
 */
export function searchTools(keyword: string) {
  return toolRegistry.searchTools(keyword);
}

/**
 * Convenience function to get tools for a specific use case
 */
export function getToolsForUseCase(useCase: {
  persona?: "academic" | "career" | "wellness" | "general";
  capability?: string;
  keyword?: string;
}) {
  let tools = toolRegistry.listTools();

  if (useCase.persona) {
    tools = toolRegistry.getToolsForPersona(useCase.persona);
  }

  if (useCase.capability) {
    tools = tools.filter((tool) => tool.capabilities.includes(useCase.capability! as any));
  }

  if (useCase.keyword) {
    tools = tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(useCase.keyword!.toLowerCase()) ||
        tool.description.toLowerCase().includes(useCase.keyword!.toLowerCase())
    );
  }

  return tools;
}

/**
 * Get formatted tool descriptions for AI prompt injection
 */
export function getToolDescriptions(persona?: "academic" | "career" | "wellness" | "general") {
  return toolRegistry.getToolDescriptionsForPrompt(persona);
}
