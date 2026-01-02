import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { SYSTEM_PROMPTS } from "./promptTemplates";

export type PersonaType = 'academic' | 'career' | 'wellness' | 'general';

export interface StudentContext {
  name?: string;
  department?: string;
  year?: number;
  major?: string;
}

export interface ChatServiceConfig {
  persona: PersonaType;
  studentContext?: StudentContext;
  conversationHistory?: { role: string; content: string }[];
}

export class StudentAdvisorChain {
  private llm: ChatGroq;
  private persona: PersonaType;
  private chatHistory: BaseMessage[];
  private prompt: ChatPromptTemplate;

  constructor(config: ChatServiceConfig) {
    this.persona = config.persona;
    this.chatHistory = [];

    // Initialize Groq LLM with optimized settings for student consultation
    this.llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY!,
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      maxTokens: 2048, // Increased for comprehensive responses with formatting
      streaming: true,
    });

    // Load existing conversation history
    if (config.conversationHistory && config.conversationHistory.length > 0) {
      this.loadConversationHistory(config.conversationHistory);
    }

    // Create prompt template with LangChain's powerful prompt composition
    this.prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPTS[this.persona]],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
    ]);
  }

  private loadConversationHistory(history: { role: string; content: string }[]) {
    for (const msg of history) {
      if (msg.role === 'user') {
        this.chatHistory.push(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        this.chatHistory.push(new AIMessage(msg.content));
      }
    }
  }

  async getResponse(userMessage: string, studentContext?: StudentContext): Promise<string> {
    try {
      // Add student context to the message if provided
      let enrichedMessage = userMessage;
      if (studentContext) {
        const contextInfo = [];
        if (studentContext.name) contextInfo.push(`Name: ${studentContext.name}`);
        if (studentContext.department) contextInfo.push(`Department: ${studentContext.department}`);
        if (studentContext.year) contextInfo.push(`Year: ${studentContext.year}`);
        if (studentContext.major) contextInfo.push(`Major: ${studentContext.major}`);
        
        if (contextInfo.length > 0) {
          enrichedMessage = `[Student context: ${contextInfo.join(', ')}]\n\n${userMessage}`;
        }
      }

      // Format the prompt with history
      const formattedPrompt = await this.prompt.formatMessages({
        chat_history: this.chatHistory,
        input: enrichedMessage,
      });

      // Get response from LLM
      const response = await this.llm.invoke(formattedPrompt);
      const responseText = response.content.toString().trim();

      // Update chat history
      this.chatHistory.push(new HumanMessage(enrichedMessage));
      this.chatHistory.push(new AIMessage(responseText));

      return responseText;
    } catch (error) {
      console.error('Error in StudentAdvisorChain:', error);
      throw new Error('Failed to generate response');
    }
  }

  async streamResponse(
    userMessage: string,
    studentContext?: StudentContext,
    onToken?: (token: string) => void
  ): Promise<string> {
    try {
      let fullResponse = '';
      
      const enrichedMessage = studentContext 
        ? `[Context: ${Object.entries(studentContext).map(([k,v]) => `${k}: ${v}`).join(', ')}]\n\n${userMessage}`
        : userMessage;

      const formattedPrompt = await this.prompt.formatMessages({
        chat_history: this.chatHistory,
        input: enrichedMessage,
      });

      const stream = await this.llm.stream(formattedPrompt);

      for await (const chunk of stream) {
        const content = chunk.content.toString();
        fullResponse += content;
        if (onToken) {
          onToken(content);
        }
      }

      // Update chat history
      this.chatHistory.push(new HumanMessage(enrichedMessage));
      this.chatHistory.push(new AIMessage(fullResponse));

      return fullResponse.trim();
    } catch (error) {
      console.error('Error in streaming response:', error);
      throw new Error('Failed to stream response');
    }
  }

  clearMemory() {
    this.chatHistory = [];
  }
}

// Utility function to generate conversation titles
export async function generateConversationTitle(firstMessage: string): Promise<string> {
  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY!,
    model: "llama-3.3-70b-versatile",
    temperature: 0.5,
    maxTokens: 50,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "Generate a short, descriptive title (max 6 words) for a conversation that starts with the following message. Return ONLY the title, nothing else."],
    ["human", "{message}"],
  ]);

  const formattedPrompt = await prompt.formatMessages({ message: firstMessage });
  const response = await llm.invoke(formattedPrompt);
  
  return response.content.toString().trim().replace(/['"]/g, '');
}
