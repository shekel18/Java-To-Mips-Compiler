export interface VirtualFile {
  name: string;
  content: string;
}

export interface ClassLayout {
  className: string;
  objectSize: string;
  layout: string[];
  vtable: string[];
}

export interface EducationalBreakdown {
  classes: ClassLayout[];
  vtableExplanation: string;
}

export interface TranslateResponse {
  mipsCode: string;
  errors: string[];
  warnings: string[];
  educationalBreakdown: EducationalBreakdown;
}
