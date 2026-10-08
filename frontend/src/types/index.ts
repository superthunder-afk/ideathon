export type PersonalityType =
  | 'dominator'
  | 'data_driven'
  | 'quiet_thinker'
  | 'wanderer'
  | 'connector'
  | 'moderator';

export interface Participant {
  id: string;
  name: string;
  role: 'student' | 'moderator' | 'ai_participant';
  personality?: PersonalityType;
  avatar: string;
  voiceId?: string;
  isSpeaking: boolean;
  totalSpeakingTimeMs: number;
}

export interface TranscriptEntry {
  id: string;
  timestamp: number;
  speakerId: string;
  speakerName: string;
  text: string;
  isStudent: boolean;
}

export interface FeedbackQuoteCitation {
  quote: string;
  context: string;
  timestampMs: number;
}

export interface FeedbackCategory {
  title: string;
  scoreOutOf10: number;
  feedback: string;
  citations: FeedbackQuoteCitation[];
}

export interface GDReport {
  overallScore: number;
  studentSpeakingPercentage: number;
  categories: {
    startingDiscussion: FeedbackCategory;
    qualityOfIdeas: FeedbackCategory;
    buildingOnOthers: FeedbackCategory;
    listeningAndRespect: FeedbackCategory;
    handlingInterruptions: FeedbackCategory;
    endingStrongly: FeedbackCategory;
  };
  missedOpportunities: string[];
}
