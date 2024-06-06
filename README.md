# Google Drive Recursive File and Folder Copy Script

This Google Apps Script project is designed to recursively copy files and folders from a source Google Drive folder to a destination folder. The script uses a master-worker model to handle large folder structures efficiently, distributing the copying tasks across multiple parallel operations.

Crucially, if you are trying to copy folders from one Google Workspace Org to another, this will allow you to automate the process. The copied files will be owned by the person running the script.

## Features

- **Recursive Copying**: Copies all files and subfolders from the source folder to the destination folder.
- **Parallel Processing**: Utilises a master-worker architecture to distribute tasks, enabling faster copying for large folder structures.
- **Continuation Tokens**: Handles long-running operations by saving state using continuation tokens, allowing the script to resume operations if it times out.
- **Security**: Includes secret key validation to ensure authorised access to the worker script.
- **Dynamic Chunking**: Processes files in manageable chunks to balance load and improve performance.
- **Retry Mechanism**: Implements exponential backoff for retries when tasks cannot be dispatched immediately.

## Setup

### Prerequisites

- Google Account with access to Google Drive and Google Apps Script.
- Basic knowledge of Google Apps Script and Google Drive API.

### Installation

1. **Create the Master Script**
   1. Open [Google Apps Script](https://script.google.com/).
   2. Create a new project.
   3. Copy and paste the following code from the 'masterScripts' folder into this project.
   4. Replace placeholder values for `fromFolderId` and `toFolderId` with your source and destination folder IDs.
   5. Save the project.

2. **Create the Worker Script**
   1. In the same project, create a new script file.
   2. Copy and paste all the files from the 'workerScripts' folder into your project.
   3. Save the project.

### Configuration

1. **Set Script Properties**
   1. Open the script project.
   2. Navigate to `File > Project Properties > Script Properties`.
   3. Add the following properties:
      - `fromFolderId`: ID of the source folder.
      - `toFolderId`: ID of the destination folder.
      - `workerUrl`: URL of the deployed worker web app.

2. **Deploy the Worker Web App**
   1. Open the Apps Script project.
   2. Navigate to `Deploy > Manage Deployments`.
   3. Click `New Deployment`.
   4. Select `Web app`.
   5. Set the access to `Anyone, even anonymous`.
   6. Deploy the web app and copy the URL.
   7. Set the `workerUrl` script property to this URL.

### Usage

#### First Run

1. **Create a secret key**
  This generates a random 256 character string that you will use as your secret key. This prevents unauthorised users from running your Web App. I also recommend stopping the deployment once the bulk copy is complete.
  1. Run the generateSecretKey() function.
  2. Navgiate to the Script Properties.
  3. Copy the 'secretKey' script property.
  4. Create a 'secretKey' script property for the worker function and paste it in there.

1. **Run the Master Script**
   1. Open the Apps Script project.
   2. Select the `startCopy()` function.
   3. Click the Run button to start the copying process.
   
### Explanation of Functions

- **Master Script Functions**:
  - `startCopy()`: Initializes the script, sets up script properties, and starts the copy process.
  - `initiateCopy()`: Manages the dispatching of copy tasks, handles retries, and processes folders.
  - `calculateChunkSize(fromFolder)`: Dynamically calculates chunk size for file processing.
  - `callWorkerWebApp(payload)`: Sends a task to the worker web app via HTTP POST.
  - `canDispatchTask()`: Checks if a new task can be dispatched based on active task count.
  - `taskCompleted()`: Updates the active task count when a task is completed.
  - `generateSecretKey()`: Generates a random secret key for security.
  - `validateSecretKey(receivedKey)`: Validates the received secret key against the stored key.
  - `clearAllTriggers()`: Clears all existing triggers.

- **Worker Script Functions**:
  - `doPost(e)`: Main function to handle POST requests from the master script, processes files and folders, and handles continuation tokens.
  - `processFileBatch(fileBatch, toFolder, startTime, maxExecutionTime, payload)`: Processes a batch of files.
  - `processRemainingFilesAndFolders(fromFolder, toFolder, startTime, maxExecutionTime, payload)`: Processes remaining files and folders recursively.
  - `checkForTimeout(startTime, maxExecutionTime, payload)`: Checks if the script is near timeout and saves state if necessary.
  - `isNearTimeout(startTime, maxExecutionTime)`: Determines if the script is near the execution time limit.
  - `generateContinuationToken()`: Generates a continuation token.
  - `saveAndRescheduleContinuationToken(payload, continuationToken)`: Saves and reschedules continuation tokens.
  - `saveContinuationToken(payload, continuationToken)`: Saves the continuation token in script properties.
  - `scheduleResume()`: Schedules the resume function.
  - `resumeTimedOutOperations()`: Resumes operations from stored continuation tokens.
  - `resumeFromContinuationToken(payload, continuationToken)`: Resumes from a specific continuation token.
  - `doesFileExist(folder, fileName)`: Checks if a file exists in a folder.
  - `findExistingFolder(folder, folderName)`: Finds an existing folder by name.
  - `callWorkerWebApp(payload)`: Sends a task to the worker web app.
  - `validateSecretKey(receivedKey)`: Validates the secret key.

### Contributing

Contributions are welcome! Please create an issue to discuss any changes or improvements before submitting a pull request.

### License

This project is licensed under the MIT License.
