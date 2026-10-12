// routes/code.js — Code execution proxy via JDoodle API
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { execute, isAvailable } = require('../utils/coderunner');

// GET /api/code/status — check if code execution engine is running
router.get('/status', async (req, res) => {
  const available = await isAvailable();
  res.json({
    available,
    engine: process.env.JDOODLE_CLIENT_ID ? 'JDoodle Cloud API' : 'Native High-Speed Runner',
    message: '✅ Code execution engine (JDoodle) is active and ready',
  });
});

// POST /api/code/run — execute code
router.post('/run', auth, async (req, res) => {
  const { code, language } = req.body;
  const stdin = req.body.stdin !== undefined ? req.body.stdin : (req.body.input || '');

  if (!code || !language)
    return res.status(400).json({ error: 'code and language are required' });

  try {
    const result = await execute(code, language, stdin);
    res.json(result);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return res.status(503).json({
        error: 'JDoodle code execution service unavailable.',
        fix:   'Verify JDoodle credentials in environment variables.',
        verdict: 'JDoodle Offline',
      });
    }
    res.status(500).json({ error: err.message });
  }
});
// POST /api/code/run-tests — execute code against an array of test cases
router.post('/run-tests', auth, async (req, res) => {
  const { code, language, testCases } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: 'code and language are required' });
  }

  const cases = Array.isArray(testCases) && testCases.length > 0
    ? testCases
    : [{ input: req.body.stdin || '', expected_output: '' }];

  const normalize = (s) => (s || '').replace(/\r\n/g, '\n').split('\n').map(l => l.trimEnd()).join('\n').trim();

  const results = [];
  let passedCount = 0;
  let overallVerdict = 'Accepted';
  let totalTime = '0s';

  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];
    const tcInput = tc.input || '';
    const expected = normalize(tc.expected_output !== undefined ? tc.expected_output : tc.expected);

    try {
      const execRes = await execute(code, language, tcInput);
      const actual = normalize(execRes.stdout);

      let tcPassed = false;
      let tcVerdict = execRes.verdict;

      if (execRes.verdict === 'Accepted') {
        if (!expected) {
          tcPassed = true;
          tcVerdict = 'Executed';
        } else if (actual === expected) {
          tcPassed = true;
          tcVerdict = 'Passed';
        } else {
          tcPassed = false;
          tcVerdict = 'Wrong Answer';
          if (overallVerdict === 'Accepted') overallVerdict = 'Wrong Answer';
        }
      } else {
        tcPassed = false;
        overallVerdict = execRes.verdict;
      }

      if (tcPassed) passedCount++;

      results.push({
        testCase: i + 1,
        passed: tcPassed,
        verdict: tcVerdict,
        input: tcInput,
        expected,
        actual,
        got: actual,
        stderr: execRes.stderr || '',
        time: execRes.time || '0.05s',
      });
      totalTime = execRes.time || totalTime;
    } catch (err) {
      results.push({
        testCase: i + 1,
        passed: false,
        verdict: 'Execution Error',
        input: tcInput,
        expected,
        actual: '',
        got: 'Error',
        stderr: err.message,
      });
      overallVerdict = 'Execution Error';
    }
  }

  const allPassed = passedCount === cases.length && cases.length > 0;
  res.json({
    verdict: allPassed ? 'Accepted' : overallVerdict,
    passedCount,
    totalCount: cases.length,
    allPassed,
    results,
    time: totalTime,
    engine: process.env.JDOODLE_CLIENT_ID ? 'JDoodle Cloud' : 'Native High-Speed Runner',
  });
});

module.exports = router;
