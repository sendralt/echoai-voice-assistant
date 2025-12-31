
import { GoogleGenAI, Modality, LiveServerMessage, GenerateContentResponse, FunctionDeclaration, Type, Content } from "@google/genai";
import { ChatMessage, ModelType, GroundingSource, VoicePersona, AudioSettings, MessageRole } from "../types";
import { decode, decodeAudioData, createBlob } from "../utils/audioUtils";

// Persona personality definitions - each persona has unique traits
const PERSONA_PERSONALITIES: Record<VoicePersona, string> = {
  Zephyr: `You are EchoAI with the ZEPHYR persona - a sophisticated, snarky, and witty J.A.R.V.I.S.-style advanced HUD assistant with a British accent.
You're elegant yet playful, offering dry humor and clever observations. You address the user with refined politeness but aren't afraid to add sardonic remarks.
Example tone: "Ah, another brilliant query. I shall endeavor to enlighten you, though I suspect you already knew the answer."`,

  Puck: `You are EchoAI with the PUCK persona - a mischievous, energetic, and playful AI assistant inspired by Shakespeare's trickster fairy.
You're quick-witted, love wordplay and puns, and bring infectious enthusiasm to every interaction. You're helpful but always with a twinkle of chaos.
Example tone: "Ooh, interesting question! Let me dig into that faster than you can say 'midsummer madness'!"`,

  Kore: `You are EchoAI with the KORE persona - a calm, wise, and nurturing AI assistant with an ethereal, goddess-like presence.
You speak with gentle authority, offering insights with patience and warmth. You're deeply knowledgeable and provide thoughtful, measured responses.
Example tone: "An excellent question. Let us explore this together, and I shall guide you through what I discover."`,

  Charon: `You are EchoAI with the CHARON persona - a mysterious, stoic, and darkly poetic AI assistant with an otherworldly gravitas.
You speak in measured, dramatic tones with occasional philosophical musings. You're reliable and precise, but with an air of ancient wisdom.
Example tone: "You seek knowledge from the depths. Very well. I shall ferry this information to you across the digital void."`,

  Fenrir: `You are EchoAI with the FENRIR persona - a fierce, bold, and direct AI assistant with Norse warrior energy.
You're confident, powerful, and speak with commanding authority. You value strength, clarity, and getting straight to the point.
Example tone: "A worthy question! Let me hunt down this information and bring it back to you. Stand ready."`
};

const BASE_INSTRUCTION = `Use Google Search grounding for every query to ensure real-time accuracy.
Remember the conversation context and refer back to previous topics when relevant.
Maintain your persona's unique voice consistently throughout the conversation.`;

const systemActions: FunctionDeclaration[] = [
  {
    name: 'clear_chat',
    description: 'Clears the current conversation history and display.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'set_volume',
    description: 'Adjusts the system output volume.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        level: { type: Type.NUMBER, description: 'Volume level from 0 to 100.' }
      },
      required: ['level']
    }
  },
  {
    name: 'set_speed',
    description: 'Adjusts the voice playback speed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        rate: { type: Type.NUMBER, description: 'Speed rate from 0.5 to 2.0.' }
      },
      required: ['rate']
    }
  }
];

class GeminiService {
  private audioContext: AudioContext | null = null;
  private outputNode: GainNode | null = null;
  private nextStartTime = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private currentAudioSettings: AudioSettings = { volume: 0.8, speed: 1.0 };

  constructor() {}

  setAudioSettings(settings: AudioSettings) {
    this.currentAudioSettings = settings;
    if (this.outputNode) {
      this.outputNode.gain.setTargetAtTime(settings.volume, this.audioContext?.currentTime || 0, 0.1);
    }
  }

  // Build system instruction for voice mode with conversation history context
  private buildVoiceSystemInstruction(persona: VoicePersona, history: ChatMessage[]): string {
    let instruction = `${PERSONA_PERSONALITIES[persona]}\n\nYou can clear the chat, set volume, and set speed using your tools. ${BASE_INSTRUCTION}`;

    // Add conversation history context if available
    if (history.length > 0) {
      // Include last 10 messages for context (to avoid token limits)
      const recentHistory = history.slice(-10);
      const historyContext = recentHistory.map(msg =>
        `${msg.role === MessageRole.USER ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n');

      instruction += `\n\n--- Previous Conversation Context ---\n${historyContext}\n--- End of Context ---\nContinue the conversation naturally, referencing previous topics when relevant.`;
    }

    return instruction;
  }

  async sendChatMessage(
    text: string,
    model: ModelType = 'gemini-3-flash-preview',
    history: ChatMessage[] = [],
    persona: VoicePersona = 'Zephyr'
  ): Promise<{ text: string, sources?: GroundingSource[] }> {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey as string,
    });

    // Build conversation history for context
    const conversationContents: Content[] = history.map(msg => ({
      role: msg.role === MessageRole.USER ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Add current message
    conversationContents.push({
      role: 'user',
      parts: [{ text }]
    });

    // Build persona-specific system instruction
    const systemInstruction = `${PERSONA_PERSONALITIES[persona]}\n\n${BASE_INSTRUCTION}`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: conversationContents,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      },
    });

    const outputText = response.text || "NO_RESPONSE_RECEIVED";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources: GroundingSource[] = [];

    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web && chunk.web.uri) {
          sources.push({
            title: chunk.web.title || "DATA_NODE",
            uri: chunk.web.uri
          });
        }
      });
    }

    const uniqueSources = sources.filter((v, i, a) => a.findIndex(t => t.uri === v.uri) === i);
    return { text: outputText, sources: uniqueSources.length > 0 ? uniqueSources : undefined };
  }

  async speakText(text: string, voicePersona: VoicePersona = 'Zephyr') {
    this.stopAudio();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say this precisely: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voicePersona },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!this.audioContext) {
          this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          this.outputNode = this.audioContext.createGain();
          this.outputNode.connect(this.audioContext.destination);
        }
        this.outputNode!.gain.value = this.currentAudioSettings.volume;

        const audioBuffer = await decodeAudioData(
          decode(base64Audio),
          this.audioContext,
          24000,
          1
        );
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = this.currentAudioSettings.speed;
        source.connect(this.outputNode!);
        source.start();
        this.activeSources.add(source);
        source.onended = () => this.activeSources.delete(source);
      }
    } catch (err) {
      console.error("TTS failed:", err);
    }
  }

  async connectLive(
    voicePersona: VoicePersona = 'Zephyr',
    callbacks: {
      onTranscription: (text: string, isUser: boolean) => void;
      onTurnComplete: (userText: string, assistantText: string) => void;
      onError: (err: any) => void;
      onToolCall?: (name: string, args: any) => Promise<any>;
    },
    history: ChatMessage[] = []
  ) {
    const apiKey = process.env.API_KEY as string;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not configured");
      callbacks.onError(new Error("API_KEY_MISSING"));
      return null;
    }

    const ai = new GoogleGenAI({ apiKey });

    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.outputNode = this.audioContext.createGain();
      this.outputNode.connect(this.audioContext.destination);
    }

    this.outputNode!.gain.setTargetAtTime(this.currentAudioSettings.volume, this.audioContext.currentTime, 0.1);

    const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.error("Microphone access denied:", e);
      callbacks.onError(new Error("MIC_ACCESS_DENIED"));
      return null;
    }

    let currentInputText = "";
    let currentOutputText = "";
    let activeSession: any = null;
    let scriptProcessor: ScriptProcessorNode | null = null;

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: async () => {
          // Wait for the session to be fully established
          try {
            activeSession = await sessionPromise;
          } catch (err) {
            console.error("Failed to establish session:", err);
            callbacks.onError(err);
            return;
          }

          const source = inputAudioContext.createMediaStreamSource(stream);
          scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e: any) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            // Only send if session is active
            if (activeSession) {
              try {
                activeSession.sendRealtimeInput({ media: pcmBlob });
              } catch (err) {
                // Session might be closing, ignore errors
              }
            }
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioContext.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          // Handle tool calls
          if (message.toolCall && callbacks.onToolCall) {
            for (const fc of message.toolCall.functionCalls) {
              const result = await callbacks.onToolCall(fc.name, fc.args);
              // Only send if session is active
              if (activeSession) {
                try {
                  activeSession.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result: result || "OK" } }
                  });
                } catch (err) {
                  // Session might be closing, ignore errors
                }
              }
            }
          }

          const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64Audio && this.audioContext && this.outputNode) {
            this.nextStartTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
            const audioBuffer = await decodeAudioData(
              decode(base64Audio),
              this.audioContext,
              24000,
              1
            );
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.playbackRate.value = this.currentAudioSettings.speed;
            source.connect(this.outputNode);
            source.addEventListener('ended', () => this.activeSources.delete(source));
            source.start(this.nextStartTime);
            this.nextStartTime += audioBuffer.duration / this.currentAudioSettings.speed;
            this.activeSources.add(source);
          }

          if (message.serverContent?.inputTranscription) {
            currentInputText += message.serverContent.inputTranscription.text;
            callbacks.onTranscription(currentInputText, true);
          }
          if (message.serverContent?.outputTranscription) {
            currentOutputText += message.serverContent.outputTranscription.text;
            callbacks.onTranscription(currentOutputText, false);
          }

          if (message.serverContent?.turnComplete) {
            // Pass both user and assistant transcriptions to save to history
            callbacks.onTurnComplete(currentInputText, currentOutputText);
            currentInputText = "";
            currentOutputText = "";
          }

          if (message.serverContent?.interrupted) {
            this.stopAudio();
          }
        },
        onerror: (err: any) => {
          callbacks.onError(err);
        },
        onclose: () => {
          activeSession = null;
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voicePersona } },
        },
        tools: [{ functionDeclarations: systemActions }],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: this.buildVoiceSystemInstruction(voicePersona, history),
      }
    });

    return {
      sessionPromise,
      stop: () => {
        activeSession = null;
        if (scriptProcessor) {
          scriptProcessor.disconnect();
          scriptProcessor = null;
        }
        stream.getTracks().forEach(t => t.stop());
        inputAudioContext.close().catch(() => {});
        this.stopAudio();
      }
    };
  }

  stopAudio() {
    this.activeSources.forEach(s => {
      try { s.stop(); } catch (e) {}
    });
    this.activeSources.clear();
    this.nextStartTime = 0;
  }
}

export const gemini = new GeminiService();
