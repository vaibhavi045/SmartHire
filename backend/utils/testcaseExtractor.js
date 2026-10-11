// utils/testcaseExtractor.js
// Extracts or retrieves test cases for Mock OA questions

function normalizeIO(str) {
  if (str == null) return '';
  return String(str)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

function getQuestionTestCases(q) {
  if (!q) return [];

  const cases = [];

  // 1. Direct database test_cases array
  if (Array.isArray(q.test_cases) && q.test_cases.length > 0) {
    q.test_cases.forEach(tc => {
      if (tc && tc.input !== undefined && tc.expected_output !== undefined) {
        cases.push({
          input: normalizeIO(tc.input),
          expected_output: normalizeIO(tc.expected_output),
          sample: !!tc.sample,
        });
      }
    });
    if (cases.length > 0) return cases;
  }

  // 2. Direct sample_input & sample_output columns
  if (q.sample_input && q.sample_output) {
    cases.push({
      input: normalizeIO(q.sample_input),
      expected_output: normalizeIO(q.sample_output),
      sample: true,
    });
  }

  const desc = q.description || q.question_text || '';

  // 3. HTML table format: <td> Sample Input </td> ... <td>```...```</td>
  const tableRegex = /Sample\s*Input[\s\S]*?Sample\s*Output[\s\S]*?<td>[\s\S]*?```(?:shell|text)?\s*([\s\S]*?)```[\s\S]*?<\/td>\s*<td>[\s\S]*?```(?:shell|text)?\s*([\s\S]*?)```[\s\S]*?<\/td>/gi;
  let tm;
  while ((tm = tableRegex.exec(desc)) !== null) {
    const inp = normalizeIO(tm[1]);
    const out = normalizeIO(tm[2]);
    if (inp && out && !cases.some(c => c.input === inp && c.expected_output === out)) {
      cases.push({ input: inp, expected_output: out, sample: true });
    }
  }

  // 4. Markdown headers: Sample Input: ```...``` Sample Output: ```...```
  const headerRegex = /Sample\s*Input:?\s*```(?:shell|text)?\s*([\s\S]*?)```[\s\S]*?Sample\s*Output:?\s*```(?:shell|text)?\s*([\s\S]*?)```/gi;
  let hm;
  while ((hm = headerRegex.exec(desc)) !== null) {
    const inp = normalizeIO(hm[1]);
    const out = normalizeIO(hm[2]);
    if (inp && out && !cases.some(c => c.input === inp && c.expected_output === out)) {
      cases.push({ input: inp, expected_output: out, sample: true });
    }
  }

  // 5. Example format: input: `...`, Output: `...`
  const exRegex = /Example\s*\d*:?[\s\S]*?input\d*:\s*[`"]?([^`"\n]+)[`"]?[\s\S]*?Output:\s*[`"]?([^`"\n]+)[`"]?/gi;
  let em;
  while ((em = exRegex.exec(desc)) !== null) {
    const inp = normalizeIO(em[1]);
    const out = normalizeIO(em[2]);
    if (inp && out && !cases.some(c => c.input === inp && c.expected_output === out)) {
      cases.push({ input: inp, expected_output: out, sample: true });
    }
  }

  // 6. Array format: power = [3,4,1,6,2] ... answer is 7
  const arrRegex = /Example\s*\d*:?[\s\S]*?(?:power|stockPrices|arr|nums)\s*(?:\[\])?\s*=\s*\[([0-9,\s]+)\][\s\S]*?(?:k\s*=\s*(\d+))?[\s\S]*?(?:answer|ans|output)\s*(?:is|=)\s*([0-9]+)/gi;
  let arm;
  while ((arm = arrRegex.exec(desc)) !== null) {
    const rawArr = arm[1].split(',').map(s => s.trim()).filter(Boolean);
    const kVal = arm[2];
    const inp = kVal ? `${rawArr.length} ${kVal}\n${rawArr.join(' ')}` : `${rawArr.length}\n${rawArr.join(' ')}`;
    const out = normalizeIO(arm[3]);
    if (inp && out && !cases.some(c => c.input === inp && c.expected_output === out)) {
      cases.push({ input: inp, expected_output: out, sample: true });
    }
  }

  return cases;
}

module.exports = {
  getQuestionTestCases,
  normalizeIO,
};
