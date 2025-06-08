// task-parser.js - 議事録からタスク・スケジュールを抽出するエンジン

/**
 * 議事録テキストからタスクとスケジュールを抽出する
 * @param {string} content - 議事録の内容
 * @param {string} title - 議事録のタイトル
 * @param {Date} meetingDate - 会議日時
 * @returns {Object} { tasks: [], meetings: [], decisions: [] }
 */
export function extractTasksAndSchedules(content, title = '', meetingDate = new Date()) {
  const result = {
    tasks: [],
    meetings: [],
    decisions: []
  };

  if (!content || typeof content !== 'string') {
    return result;
  }

  // テキストを行ごとに分割
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Level 1: 明示的パターンの抽出
  result.tasks.push(...extractExplicitTasks(lines, meetingDate));
  result.meetings.push(...extractMeetings(lines, meetingDate));
  result.decisions.push(...extractDecisions(lines));
  
  // Level 2: 自然言語パターンの抽出
  const remainingText = lines.join(' ');
  result.tasks.push(...extractNaturalLanguageTasks(remainingText, meetingDate));
  
  // 重複削除とソート
  result.tasks = deduplicateTasks(result.tasks);
  result.meetings = deduplicateMeetings(result.meetings);
  result.decisions = deduplicateDecisions(result.decisions);
  
  return result;
}

/**
 * Level 1: 明示的パターンでタスクを抽出
 */
function extractExplicitTasks(lines, meetingDate) {
  const tasks = [];
  const taskPatterns = [
    // TODO系
    /^TODO[：:]\s*(.+)/i,
    /^やること[：:]\s*(.+)/i,
    /^タスク[：:]\s*(.+)/i,
    
    // チェックボックス系
    /^[⬜☐□▢]\s*(.+)/,
    /^[-*]\s*\[\s*\]\s*(.+)/,
    
    // 担当者系
    /^担当[：:]\s*(.+)/,
    /^責任者[：:]\s*(.+)/,
    
    // 期限系
    /^締切[：:]\s*(.+)/,
    /^期限[：:]\s*(.+)/,
    /^期日[：:]\s*(.+)/,
    /^まで[：:]\s*(.+)/
  ];

  let currentTask = null;
  
  for (const line of lines) {
    let matched = false;
    
    for (const pattern of taskPatterns) {
      const match = line.match(pattern);
      if (match) {
        const content = match[1].trim();
        
        if (pattern.source.includes('担当') || pattern.source.includes('責任者')) {
          // 担当者情報
          if (currentTask) {
            currentTask.assignee = extractAssignee(content);
          }
        } else if (pattern.source.includes('締切') || pattern.source.includes('期限') || pattern.source.includes('まで')) {
          // 期限情報
          if (currentTask) {
            currentTask.deadline = extractDeadline(content, meetingDate);
            currentTask.deadlineText = content;
          }
        } else {
          // 新しいタスク
          currentTask = {
            id: generateTaskId(),
            content: content,
            type: 'task',
            status: 'todo',
            priority: 'medium',
            assignee: null,
            deadline: null,
            deadlineText: null,
            source: 'explicit',
            createdAt: new Date()
          };
          
          // 担当者と期限が同じ行にある場合
          const assigneeMatch = content.match(/(.+?)[を|が]\s*([^\s]+?)[さん|氏|君]?[が|は]\s*(.+)/);
          if (assigneeMatch) {
            currentTask.content = assigneeMatch[1].trim() + assigneeMatch[3].trim();
            currentTask.assignee = assigneeMatch[2].trim();
          }
          
          const deadlineMatch = content.match(/(.+?)\s*([0-9]+月[0-9]+日|来週|今週|今月|来月|[0-9]+日まで)/);
          if (deadlineMatch) {
            currentTask.content = deadlineMatch[1].trim();
            currentTask.deadline = extractDeadline(deadlineMatch[2], meetingDate);
            currentTask.deadlineText = deadlineMatch[2];
          }
          
          tasks.push(currentTask);
        }
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      currentTask = null; // パターンにマッチしない行が来たらリセット
    }
  }
  
  return tasks;
}

/**
 * Level 2: 自然言語パターンでタスクを抽出
 */
function extractNaturalLanguageTasks(text, meetingDate) {
  const tasks = [];
  
  // 動詞パターン（〜する、〜を確認、〜を調整など）
  const actionPatterns = [
    /([^\s。、]+?)([さん|氏|君]?)が\s*([^\s。、]+?)[を|に]\s*(確認|調整|検討|準備|作成|実施|対応|連絡)[する|します|した]?/g,
    /([^\s。、]+?)[を|に]\s*(確認|調整|検討|準備|作成|実施|対応|連絡)[する|します|が必要]/g,
    /([^\s。、]+?)について\s*(確認|調整|検討|準備|作成|実施|対応)[する|します]?/g
  ];
  
  for (const pattern of actionPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const task = {
        id: generateTaskId(),
        content: match[0].trim(),
        type: 'task',
        status: 'todo',
        priority: 'medium',
        assignee: match[1] && !match[1].includes('を') && !match[1].includes('に') ? match[1].replace(/さん|氏|君/, '') : null,
        deadline: null,
        deadlineText: null,
        source: 'natural_language',
        createdAt: new Date()
      };
      
      tasks.push(task);
    }
  }
  
  return tasks;
}

/**
 * 会議・スケジュール情報の抽出
 */
function extractMeetings(lines, meetingDate) {
  const meetings = [];
  const meetingPatterns = [
    /^次回[会議|ミーティング|打ち合わせ][：:]\s*(.+)/i,
    /^会議[予定|日程][：:]\s*(.+)/i,
    /^[0-9]+月[0-9]+日.*[0-9]+[：:][0-9]+.*[会議|ミーティング|打ち合わせ]/i
  ];
  
  for (const line of lines) {
    for (const pattern of meetingPatterns) {
      const match = line.match(pattern);
      if (match) {
        const meeting = {
          id: generateTaskId(),
          title: '会議予定',
          content: match[1] || match[0],
          type: 'meeting',
          date: extractMeetingDate(match[1] || match[0], meetingDate),
          source: 'explicit',
          createdAt: new Date()
        };
        meetings.push(meeting);
      }
    }
  }
  
  return meetings;
}

/**
 * 決定事項の抽出
 */
function extractDecisions(lines) {
  const decisions = [];
  const decisionPatterns = [
    /^決定[事項]?[：:]\s*(.+)/i,
    /^決まったこと[：:]\s*(.+)/i,
    /^合意[事項]?[：:]\s*(.+)/i
  ];
  
  for (const line of lines) {
    for (const pattern of decisionPatterns) {
      const match = line.match(pattern);
      if (match) {
        const decision = {
          id: generateTaskId(),
          content: match[1].trim(),
          type: 'decision',
          createdAt: new Date()
        };
        decisions.push(decision);
      }
    }
  }
  
  return decisions;
}

/**
 * 担当者名の抽出・正規化
 */
function extractAssignee(text) {
  // 敬称を除去
  const cleaned = text.replace(/さん|氏|君|様/g, '').trim();
  
  // 複数人の場合は最初の人を返す
  const names = cleaned.split(/[、,・]/);
  return names[0].trim();
}

/**
 * 期限日の抽出・正規化
 */
function extractDeadline(text, baseDate) {
  const now = new Date(baseDate);
  
  // 具体的な日付パターン
  const dateMatch = text.match(/([0-9]+)月([0-9]+)日/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]);
    const day = parseInt(dateMatch[2]);
    const year = month >= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear() + 1;
    return new Date(year, month - 1, day);
  }
  
  // 相対的な期限
  if (text.includes('今日')) {
    return new Date(now);
  } else if (text.includes('明日')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  } else if (text.includes('今週')) {
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    return endOfWeek;
  } else if (text.includes('来週')) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek;
  } else if (text.includes('今月')) {
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return endOfMonth;
  } else if (text.includes('来月')) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return nextMonth;
  }
  
  return null;
}

/**
 * 会議日時の抽出
 */
function extractMeetingDate(text, baseDate) {
  const dateMatch = text.match(/([0-9]+)月([0-9]+)日/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]);
    const day = parseInt(dateMatch[2]);
    const year = month >= baseDate.getMonth() + 1 ? baseDate.getFullYear() : baseDate.getFullYear() + 1;
    
    const timeMatch = text.match(/([0-9]+)[：:]([0-9]+)/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = parseInt(timeMatch[2]);
      return new Date(year, month - 1, day, hour, minute);
    }
    
    return new Date(year, month - 1, day);
  }
  
  return null;
}

/**
 * 重複削除関数
 */
function deduplicateTasks(tasks) {
  const seen = new Set();
  return tasks.filter(task => {
    const key = `${task.content}_${task.assignee || 'none'}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function deduplicateMeetings(meetings) {
  const seen = new Set();
  return meetings.filter(meeting => {
    const key = `${meeting.content}_${meeting.date?.getTime() || 'none'}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function deduplicateDecisions(decisions) {
  const seen = new Set();
  return decisions.filter(decision => {
    if (seen.has(decision.content)) {
      return false;
    }
    seen.add(decision.content);
    return true;
  });
}

/**
 * ユニークID生成
 */
function generateTaskId() {
  return 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * 抽出結果のテスト用関数
 */
export function testTaskExtraction() {
  const sampleText = `
第3回企画会議の議事録

TODO: チラシデザインを田中さんが9月15日まで作成
担当: 佐藤さん
締切: 来週まで

会場予約について確認する必要がある
山田さんが音響設備を調整します

決定事項: 参加費を3000円に設定
次回会議: 9月20日 15:00〜

⬜ 資料準備
⬜ 告知文作成
`;

  const result = extractTasksAndSchedules(sampleText, '第3回企画会議', new Date('2025-09-01'));
  console.log('=== タスク抽出テスト結果 ===');
  console.log('タスク:', result.tasks);
  console.log('会議:', result.meetings);
  console.log('決定事項:', result.decisions);
  
  return result;
}
