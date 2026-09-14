export type CaseQuestionRef = {
  question_id: string;
  case_study_id?: string | null;
  case_title?: string | null;
  case_scenario?: string | null;
  case_study_order?: number | null;
};

export type CaseGroup = {
  caseId: string;
  title: string;
  scenario: string;
  questionIds: string[];
  startIndex: number;
  endIndex: number;
};

export function groupQuestionsByCase(questions: CaseQuestionRef[]): CaseGroup[] {
  const groups: CaseGroup[] = [];
  questions.forEach((question, index) => {
    const caseId = question.case_study_id ?? `loose-${question.question_id}`;
    const last = groups[groups.length - 1];
    if (last && last.caseId === caseId) {
      last.questionIds.push(question.question_id);
      last.endIndex = index;
      return;
    }
    groups.push({
      caseId,
      title: question.case_title ?? "Case",
      scenario: question.case_scenario ?? "",
      questionIds: [question.question_id],
      startIndex: index,
      endIndex: index,
    });
  });
  return groups;
}

export function caseProgressAt(groups: CaseGroup[], questionIndex: number) {
  const groupIndex = groups.findIndex((group) => questionIndex >= group.startIndex && questionIndex <= group.endIndex);
  const group = groupIndex >= 0 ? groups[groupIndex] : null;
  return {
    group,
    groupIndex,
    caseOrdinal: groupIndex + 1,
    caseCount: groups.length,
    questionInCase: group ? questionIndex - group.startIndex + 1 : 1,
    questionsInCase: group?.questionIds.length ?? 0,
    isFirstInCase: Boolean(group && questionIndex === group.startIndex),
    isLastInCase: Boolean(group && questionIndex === group.endIndex),
  };
}
