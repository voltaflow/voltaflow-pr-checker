const core = require('@actions/core');
const github = require('@actions/github');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Mock all external modules
jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('openai');

// Save original implementation of console.log/error
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('voltaflow-pr-check', () => {
  // Setup and teardown for each test
  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();
    // Mock console.log to avoid noisy test output but still allow spying
    console.log = jest.fn();
    console.error = jest.fn();
    
    // Setup default inputs
    core.getInput.mockImplementation((name) => {
      if (name === 'github_token') return 'fake-token';
      if (name === 'deepseek_api_key') return 'fake-api-key';
      if (name === 'log_content') return 'sample log content';
      return '';
    });
    
    // Setup GitHub context
    github.context = {
      repo: { owner: 'test-owner', repo: 'test-repo' },
      issue: { number: 123 }
    };
    
    // Mock Octokit for GitHub API interactions
    const mockCreateComment = jest.fn().mockResolvedValue({});
    github.getOctokit.mockReturnValue({
      rest: {
        issues: {
          createComment: mockCreateComment
        }
      }
    });
    
    // Mock OpenAI client for Deepseek
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Test response from Deepseek' } }]
          })
        }
      }
    }));
  });
  
  // Restore console after tests
  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  test('should process logs and comment on PR', async () => {
    // Import the main module - after mocks are setup
    const main = require('../index.js');
    
    // Need to wait for any promises in the module to resolve
    await new Promise(process.nextTick);
    
    // Verify OpenAI client was configured correctly
    expect(OpenAI).toHaveBeenCalledWith({
      baseURL: 'https://api.deepseek.com',
      apiKey: 'fake-api-key'
    });
    
    // Verify OpenAI chat completions were called with the right parameters
    const openaiInstance = new OpenAI();
    expect(openaiInstance.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: "system", content: expect.stringContaining("expert in interpreting computer system logs") },
          { role: "user", content: "sample log content" }
        ]),
        model: "deepseek-chat",
      })
    );
    
    // Verify GitHub comment was created
    const octokit = github.getOctokit();
    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      body: expect.stringContaining('Test response from Deepseek')
    });
    
    // Verify output was set
    expect(core.setOutput).toHaveBeenCalledWith(
      'interpretation',
      'Test response from Deepseek'
    );
  });

  test('should handle missing log content gracefully', async () => {
    // Set up input mock to return empty log content
    core.getInput.mockImplementation((name) => {
      if (name === 'github_token') return 'fake-token';
      if (name === 'deepseek_api_key') return 'fake-api-key';
      if (name === 'log_content') return '';
      return '';
    });
    
    // Import the main module after updating mocks
    jest.isolateModules(() => {
      require('../index.js');
    });
    
    // Wait for any promises
    await new Promise(process.nextTick);
    
    // Should warn about missing log content
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('No log content was provided')
    );
    
    // Should still proceed with default message
    const openaiInstance = new OpenAI();
    expect(openaiInstance.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.any(Object),
          { role: "user", content: expect.stringContaining("No log content was provided") }
        ])
      })
    );
  });

  test('should handle API errors', async () => {
    // Setup OpenAI to throw an error
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('API error test'))
        }
      }
    }));
    
    // Import the main module
    jest.isolateModules(() => {
      require('../index.js');
    });
    
    // Wait for any promises
    await new Promise(process.nextTick);
    
    // Should mark the action as failed
    expect(core.setFailed).toHaveBeenCalledWith('API error test');
  });

  test('should handle missing PR context', async () => {
    // Setup context without PR number
    github.context = {
      repo: { owner: 'test-owner', repo: 'test-repo' },
      issue: { number: undefined }
    };
    
    // Import the main module
    jest.isolateModules(() => {
      require('../index.js');
    });
    
    // Wait for any promises
    await new Promise(process.nextTick);
    
    // Should not try to comment on PR
    const octokit = github.getOctokit();
    expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
    
    // Should log to console instead
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('No associated PR was found')
    );
  });
});

// Uncomment this test if you want to do actual file reading tests
// describe('voltaflow-pr-check with real log fixtures', () => {
//   test('should process error logs correctly', async () => {
//     const errorLogs = fs.readFileSync(
//       path.join(__dirname, 'fixtures/error_log.txt'),
//       'utf8'
//     );
//     
//     core.getInput.mockImplementation((name) => {
//       if (name === 'github_token') return 'fake-token';
//       if (name === 'deepseek_api_key') return 'fake-api-key';
//       if (name === 'log_content') return errorLogs;
//       return '';
//     });
//     
//     // This test would need actual API calls, so it's commented out
//     // You could use it with proper mocking for integration testing
//   });
// });
