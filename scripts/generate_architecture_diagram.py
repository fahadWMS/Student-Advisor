"""
Generate Architecture Diagram for Student Consultation AI Research Paper
Uses matplotlib to create a professional system architecture diagram
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Circle
import numpy as np

# Set up the figure with high DPI for publication quality
fig, ax = plt.subplots(1, 1, figsize=(14, 10), dpi=150)
ax.set_xlim(0, 14)
ax.set_ylim(0, 10)
ax.set_aspect('equal')
ax.axis('off')

# Define colors for different layers
colors = {
    'ui_layer': '#E3F2FD',      # Light blue
    'api_layer': '#FFF3E0',      # Light orange
    'agent_layer': '#E8F5E9',    # Light green
    'external_layer': '#F3E5F5', # Light purple
    'component': '#FFFFFF',       # White
    'coordinator': '#BBDEFB',     # Blue
    'specialist': '#C8E6C9',      # Green
    'llm': '#FFE0B2',            # Orange
    'database': '#E1BEE7',        # Purple
    'voice': '#B2EBF2',          # Cyan
    'vision': '#FFCCBC',         # Peach
}

def draw_rounded_box(ax, x, y, width, height, color, label, fontsize=9, bold=False):
    """Draw a rounded rectangle with centered label"""
    box = FancyBboxPatch((x, y), width, height,
                         boxstyle="round,pad=0.02,rounding_size=0.15",
                         facecolor=color, edgecolor='#424242', linewidth=1.5)
    ax.add_patch(box)
    weight = 'bold' if bold else 'normal'
    ax.text(x + width/2, y + height/2, label, ha='center', va='center',
            fontsize=fontsize, fontweight=weight, wrap=True)

def draw_layer_box(ax, x, y, width, height, color, label):
    """Draw a layer container with title on top-left"""
    box = FancyBboxPatch((x, y), width, height,
                         boxstyle="round,pad=0.02,rounding_size=0.2",
                         facecolor=color, edgecolor='#616161', linewidth=2, alpha=0.7)
    ax.add_patch(box)
    ax.text(x + 0.15, y + height - 0.3, label, ha='left', va='top',
            fontsize=11, fontweight='bold', color='#424242')

def draw_arrow(ax, start, end, color='#424242', style='->'):
    """Draw an arrow between two points"""
    ax.annotate('', xy=end, xytext=start,
                arrowprops=dict(arrowstyle=style, color=color, lw=1.5,
                               connectionstyle='arc3,rad=0'))

# Layer 1: User Interface (Top)
draw_layer_box(ax, 0.3, 8.0, 13.4, 1.8, colors['ui_layer'], 'User Interface Layer')
draw_rounded_box(ax, 0.8, 8.3, 2.5, 1.1, colors['component'], 'Chat Interface\n(React)', 8)
draw_rounded_box(ax, 3.6, 8.3, 2.5, 1.1, colors['voice'], 'Voice Recorder\n(Web Audio API)', 8)
draw_rounded_box(ax, 6.4, 8.3, 2.5, 1.1, colors['vision'], 'Image Upload\n(Multimodal)', 8)
draw_rounded_box(ax, 9.2, 8.3, 2.2, 1.1, colors['component'], 'Document\nLibrary', 8)
draw_rounded_box(ax, 11.7, 8.3, 1.7, 1.1, colors['component'], 'Auth\n(NextAuth)', 8)

# Layer 2: API Gateway
draw_layer_box(ax, 0.3, 5.8, 13.4, 1.8, colors['api_layer'], 'API Gateway (Next.js API Routes)')
draw_rounded_box(ax, 0.8, 6.1, 2.0, 1.0, colors['component'], '/api/chat\n(SSE)', 8)
draw_rounded_box(ax, 3.0, 6.1, 2.2, 1.0, colors['component'], '/api/voice\n(STT/TTS)', 8)
draw_rounded_box(ax, 5.4, 6.1, 2.2, 1.0, colors['component'], '/api/images\n(analyze)', 8)
draw_rounded_box(ax, 7.8, 6.1, 2.2, 1.0, colors['component'], '/api/documents\n(upload)', 8)
draw_rounded_box(ax, 10.2, 6.1, 1.9, 1.0, colors['component'], '/api/auth\n(session)', 8)
draw_rounded_box(ax, 12.3, 6.1, 1.2, 1.0, colors['component'], '/api\n/profile', 7)

# Layer 3: Agent System (Main Processing)
draw_layer_box(ax, 0.3, 2.5, 13.4, 3.0, colors['agent_layer'], 'Multi-Agent System')

# Coordinator (center-top of agent layer)
draw_rounded_box(ax, 5.5, 4.4, 3.0, 0.9, colors['coordinator'], 'Coordinator Agent\n(Intent Classification)', 9, bold=True)

# Specialist agents row
draw_rounded_box(ax, 0.8, 3.0, 2.5, 1.0, colors['specialist'], 'Academic\nAdvisor', 9)
draw_rounded_box(ax, 3.6, 3.0, 2.5, 1.0, colors['specialist'], 'Career\nAdvisor', 9)
draw_rounded_box(ax, 6.4, 3.0, 2.5, 1.0, colors['specialist'], 'Wellness\nAdvisor', 9)
draw_rounded_box(ax, 9.2, 3.0, 2.5, 1.0, colors['specialist'], 'General\nAdvisor', 9)

# Model Rotation
draw_rounded_box(ax, 12.0, 3.6, 1.5, 1.5, colors['llm'], 'Model\nRotation\n(Failover)', 8)

# Layer 4: External Services (Bottom)
draw_layer_box(ax, 0.3, 0.3, 13.4, 1.8, colors['external_layer'], 'External Services')

# LLM Providers
draw_rounded_box(ax, 0.8, 0.6, 2.3, 1.1, colors['llm'], 'Groq\n(Llama 3.3 70B)', 8)
draw_rounded_box(ax, 3.3, 0.6, 2.3, 1.1, colors['llm'], 'Google Gemini\n(2.0/2.5 Flash)', 8)

# Vector DB
draw_rounded_box(ax, 5.8, 0.6, 2.3, 1.1, colors['database'], 'Pinecone\n(Vector DB)', 8)

# Speech Services
draw_rounded_box(ax, 8.3, 0.6, 2.0, 1.1, colors['voice'], 'Whisper\n(STT)', 8)
draw_rounded_box(ax, 10.5, 0.6, 1.5, 1.1, colors['voice'], 'gTTS\n(TTS)', 8)

# Database
draw_rounded_box(ax, 12.2, 0.6, 1.3, 1.1, colors['database'], 'PostgreSQL\n(Prisma)', 7)

# Draw arrows - UI to API
for x in [2.05, 4.85, 7.65, 10.3, 12.55]:
    draw_arrow(ax, (x, 8.3), (x, 7.1))

# API to Agent System
draw_arrow(ax, (1.8, 6.1), (7.0, 5.3), style='->')
draw_arrow(ax, (4.1, 6.1), (7.0, 5.3), style='->')
draw_arrow(ax, (6.5, 6.1), (7.0, 5.3), style='->')

# Coordinator to Specialists
for x in [2.05, 4.85, 7.65, 10.45]:
    draw_arrow(ax, (7.0, 4.4), (x, 4.0))
    draw_arrow(ax, (x, 4.0), (x, 4.0))
    ax.annotate('', xy=(x, 4.0), xytext=(7.0, 4.4),
                arrowprops=dict(arrowstyle='->', color='#424242', lw=1.2,
                               connectionstyle='arc3,rad=0.2'))

# Coordinator to Model Rotation
draw_arrow(ax, (8.5, 4.85), (12.0, 4.35))

# Specialists to External Services
draw_arrow(ax, (2.05, 3.0), (2.0, 1.7))
draw_arrow(ax, (4.85, 3.0), (4.5, 1.7))
draw_arrow(ax, (7.65, 3.0), (7.0, 1.7))

# Model Rotation to LLM Providers
draw_arrow(ax, (12.75, 3.6), (2.0, 1.7))
ax.annotate('', xy=(1.95, 1.7), xytext=(12.75, 3.6),
            arrowprops=dict(arrowstyle='->', color='#FF6F00', lw=2,
                           connectionstyle='arc3,rad=0.3', alpha=0.7))
ax.annotate('', xy=(4.45, 1.7), xytext=(12.75, 3.6),
            arrowprops=dict(arrowstyle='->', color='#FF6F00', lw=2,
                           connectionstyle='arc3,rad=0.2', alpha=0.7))

# Add title
ax.text(7.0, 9.9, 'Student Consultation AI - System Architecture', 
        ha='center', va='center', fontsize=14, fontweight='bold')

# Add legend
legend_elements = [
    mpatches.Patch(facecolor=colors['coordinator'], edgecolor='#424242', label='Coordinator'),
    mpatches.Patch(facecolor=colors['specialist'], edgecolor='#424242', label='Specialist Agents'),
    mpatches.Patch(facecolor=colors['llm'], edgecolor='#424242', label='LLM Services'),
    mpatches.Patch(facecolor=colors['database'], edgecolor='#424242', label='Databases'),
    mpatches.Patch(facecolor=colors['voice'], edgecolor='#424242', label='Voice/Speech'),
]
ax.legend(handles=legend_elements, loc='upper right', fontsize=8, 
          framealpha=0.9, edgecolor='#424242')

# Add data flow annotation
ax.annotate('SSE Streaming', xy=(1.8, 7.7), fontsize=7, color='#1565C0', style='italic')

plt.tight_layout()
plt.savefig('architecture_diagram.png', dpi=300, bbox_inches='tight', 
            facecolor='white', edgecolor='none')
plt.savefig('architecture_diagram.pdf', bbox_inches='tight', 
            facecolor='white', edgecolor='none')
print("Architecture diagram saved as 'architecture_diagram.png' and 'architecture_diagram.pdf'")
plt.show()
