/**
 * Tool System Type Definitions
 * Defines interfaces for extensible agent tools
 */

export type PersonaType = "academic" | "career" | "wellness" | "general";

export type ToolParameterType = "string" | "number" | "boolean" | "array" | "object";

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  type: ToolParameterType;
  description: string;
  required: boolean;
  default?: any;
  enum?: string[];
  items?: {
    type: ToolParameterType;
  };
}

/**
 * Context passed to tool execution
 */
export interface ToolContext {
  userId?: string;
  conversationId?: string;
  persona?: PersonaType;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Result returned by tool execution
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    tokensUsed?: number;
    latency?: number;
    source?: string;
    [key: string]: any;
  };
}

/**
 * Tool capability tags for discovery
 */
export type ToolCapability =
  | "rag"
  | "document-search"
  | "calculation"
  | "gpa"
  | "grades"
  | "web-search"
  | "calendar"
  | "email"
  | "analysis"
  | "recommendation";

/**
 * Core tool interface
 */
export interface Tool {
  /** Unique tool identifier */
  name: string;

  /** Human-readable description of what the tool does */
  description: string;

  /** Tool parameters with types and validation */
  parameters: Record<string, ToolParameter>;

  /** Capability tags for discovery */
  capabilities: ToolCapability[];

  /** Personas this tool is most relevant for */
  personas: PersonaType[];

  /** Execute the tool with given parameters and context */
  execute: (
    params: Record<string, any>,
    context: ToolContext
  ) => Promise<ToolResult>;

  /** Optional: Validate parameters before execution */
  validate?: (params: Record<string, any>) => { valid: boolean; errors?: string[] };

  /** Optional: Example usage */
  examples?: Array<{
    description: string;
    params: Record<string, any>;
    expectedResult?: any;
  }>;
}

/**
 * Tool registry interface
 */
export interface ToolRegistry {
  /** Register a new tool */
  register: (tool: Tool) => void;

  /** Get a tool by name */
  getTool: (name: string) => Tool | undefined;

  /** Get all registered tools */
  listTools: () => Tool[];

  /** Get tools by capability */
  getToolsByCapability: (capability: ToolCapability) => Tool[];

  /** Get tools suitable for a persona */
  getToolsForPersona: (persona: PersonaType) => Tool[];

  /** Check if a tool exists */
  hasTool: (name: string) => boolean;

  /** Get tool names */
  getToolNames: () => string[];
}

/**
 * RAG search parameters
 */
export interface RagSearchParams {
  query: string;
  userId?: string;
  category?: PersonaType;
  topK?: number;
  minScore?: number;
  namespace?: string;
  includeUserDocs?: boolean;
}

/**
 * RAG search result
 */
export interface RagSearchResult {
  chunks: Array<{
    id: string;
    text: string;
    score: number;
    metadata: {
      category: string;
      source: string;
      fileName?: string;
      documentId?: string;
      [key: string]: any;
    };
  }>;
  query: string;
  resultCount: number;
  searchTime?: number;
}

/**
 * Calculator parameters
 */
export interface CalculatorParams {
  operation: "gpa" | "grade-conversion" | "weighted-gpa" | "credits-needed";
  data: Record<string, any>;
}

/**
 * GPA calculation result
 */
export interface GpaResult {
  gpa: number;
  scale: number;
  totalCredits?: number;
  courses?: Array<{
    name: string;
    grade: string;
    credits: number;
    points: number;
  }>;
}

/**
 * Grade conversion result
 */
export interface GradeConversionResult {
  percentage?: number;
  letterGrade?: string;
  gpaPoints?: number;
  scale: string;
}
