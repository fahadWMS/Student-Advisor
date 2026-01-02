/**
 * Tool Registry
 * Central registry for discovering and accessing agent tools
 */

import {
  Tool,
  ToolRegistry,
  ToolCapability,
  PersonaType,
} from "./types";

/**
 * Tool Registry Implementation
 */
class ToolRegistryImpl implements ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a new tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool "${tool.name}" is already registered. Overwriting...`);
    }
    this.tools.set(tool.name, tool);
    console.log(`✅ Registered tool: ${tool.name}`);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  listTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by capability
   */
  getToolsByCapability(capability: ToolCapability): Tool[] {
    return this.listTools().filter((tool) =>
      tool.capabilities.includes(capability)
    );
  }

  /**
   * Get tools suitable for a persona
   */
  getToolsForPersona(persona: PersonaType): Tool[] {
    return this.listTools().filter(
      (tool) =>
        tool.personas.includes(persona) || tool.personas.includes("general")
    );
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    const deleted = this.tools.delete(name);
    if (deleted) {
      console.log(`🗑️ Unregistered tool: ${name}`);
    }
    return deleted;
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
    console.log("🗑️ Cleared all tools from registry");
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number;
    toolsByCapability: Record<string, number>;
    toolsByPersona: Record<string, number>;
  } {
    const tools = this.listTools();
    const toolsByCapability: Record<string, number> = {};
    const toolsByPersona: Record<string, number> = {};

    tools.forEach((tool) => {
      // Count capabilities
      tool.capabilities.forEach((cap) => {
        toolsByCapability[cap] = (toolsByCapability[cap] || 0) + 1;
      });

      // Count personas
      tool.personas.forEach((persona) => {
        toolsByPersona[persona] = (toolsByPersona[persona] || 0) + 1;
      });
    });

    return {
      totalTools: tools.length,
      toolsByCapability,
      toolsByPersona,
    };
  }

  /**
   * Search tools by keyword in name or description
   */
  searchTools(keyword: string): Tool[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.listTools().filter(
      (tool) =>
        tool.name.toLowerCase().includes(lowerKeyword) ||
        tool.description.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Get tool descriptions for prompt injection
   */
  getToolDescriptionsForPrompt(persona?: PersonaType): string {
    const tools = persona
      ? this.getToolsForPersona(persona)
      : this.listTools();

    if (tools.length === 0) {
      return "No tools available.";
    }

    const descriptions = tools.map((tool, index) => {
      const params = Object.entries(tool.parameters)
        .map(([name, param]) => {
          const required = param.required ? " (required)" : " (optional)";
          return `  - ${name}: ${param.type}${required} - ${param.description}`;
        })
        .join("\n");

      return `${index + 1}. ${tool.name}
   Description: ${tool.description}
   Capabilities: ${tool.capabilities.join(", ")}
   Parameters:
${params}`;
    });

    return `Available Tools:\n\n${descriptions.join("\n\n")}`;
  }
}

// Create singleton instance
const registry = new ToolRegistryImpl();

// Export registry instance
export default registry;

// Export registry methods as functions for convenience
export const registerTool = (tool: Tool) => registry.register(tool);
export const getTool = (name: string) => registry.getTool(name);
export const listTools = () => registry.listTools();
export const getToolsByCapability = (capability: ToolCapability) =>
  registry.getToolsByCapability(capability);
export const getToolsForPersona = (persona: PersonaType) =>
  registry.getToolsForPersona(persona);
export const hasTool = (name: string) => registry.hasTool(name);
export const getToolNames = () => registry.getToolNames();
export const getRegistryStats = () => registry.getStats();
export const searchTools = (keyword: string) => registry.searchTools(keyword);
export const getToolDescriptionsForPrompt = (persona?: PersonaType) =>
  registry.getToolDescriptionsForPrompt(persona);

/**
 * Helper function to validate tool parameters
 */
export function validateToolParams(
  tool: Tool,
  params: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required parameters
  Object.entries(tool.parameters).forEach(([name, param]) => {
    if (param.required && !(name in params)) {
      errors.push(`Missing required parameter: ${name}`);
    }

    // Type validation (basic)
    if (name in params) {
      const value = params[name];
      const expectedType = param.type;

      if (expectedType === "string" && typeof value !== "string") {
        errors.push(`Parameter "${name}" must be a string`);
      } else if (expectedType === "number" && typeof value !== "number") {
        errors.push(`Parameter "${name}" must be a number`);
      } else if (expectedType === "boolean" && typeof value !== "boolean") {
        errors.push(`Parameter "${name}" must be a boolean`);
      } else if (expectedType === "array" && !Array.isArray(value)) {
        errors.push(`Parameter "${name}" must be an array`);
      } else if (
        expectedType === "object" &&
        (typeof value !== "object" || Array.isArray(value))
      ) {
        errors.push(`Parameter "${name}" must be an object`);
      }

      // Enum validation
      if (param.enum && !param.enum.includes(value)) {
        errors.push(
          `Parameter "${name}" must be one of: ${param.enum.join(", ")}`
        );
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Helper function to execute a tool with validation
 */
export async function executeTool(
  toolName: string,
  params: Record<string, any>,
  context: any
) {
  const tool = getTool(toolName);

  if (!tool) {
    return {
      success: false,
      error: `Tool "${toolName}" not found`,
    };
  }

  // Validate parameters
  const validation = tool.validate
    ? tool.validate(params)
    : validateToolParams(tool, params);

  if (!validation.valid) {
    return {
      success: false,
      error: `Parameter validation failed: ${validation.errors?.join(", ")}`,
    };
  }

  // Execute tool
  try {
    const startTime = Date.now();
    const result = await tool.execute(params, context);
    const latency = Date.now() - startTime;

    return {
      ...result,
      metadata: {
        ...result.metadata,
        latency,
        toolName,
      },
    };
  } catch (error) {
    console.error(`Error executing tool "${toolName}":`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
