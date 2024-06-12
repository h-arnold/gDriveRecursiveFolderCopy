//Declares Global Variables for Script
//=========================================================

var SCHEDULED = false
const START_TIME = new Date().getTime();
const MAX_EXECUTION_TIME = 2.5 * 60 * 1000
const SECRET_KEY = getSecretKey()

//Run this function to get the process started.

function startCopy() {
  //Gets the folders to copy from and copy to

  const fromFolderId = "THE FOLDER ID OF THE GOOGLE DRIVE FOLDER YOU'RE COPYING FROM"
  const toFolderId = "THE FOLDER ID OF THE GOOGLE DRIVE FOLDER YOU ARE COPYING TO"

  const fromFolder = DriveApp.getFolderById(fromFolderId);
  const toFolder = DriveApp.getFolderById(toFolderId);

  //Clears all triggers
  clearAllTriggers();

  //Resets retries
  resetRetries();

  //Sets active tasks counter to 0
  resetActiveTasks();

  //Deletes any resumption script properties
  clearResumeProperties();

  //Sets the continueRunning flag to true
  enableRunningOfChildFunctions();

  //Sets retries back to 0.
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.deleteProperty('retries')


  processFilesAndFolders(fromFolder, toFolder, false);
  
}

//WebApp Code. doPost handles the requests send via https.
//=========================================================
function doPost(e) {
  //Checks if the continue script flag is set and if it's false, does not run the rest of the code.

  if (!continueScript()) {
    return;
  } 

  //Debug function
  storeParams(e)

  //Assign payload to variables
  let payload = JSON.parse(e.postData.contents);
  let fromFolderId = payload.fromFolderId;
  let toFolderId = payload.toFolderId;
  let receivedSecretKey = payload.secretKey;
  let fileOrFolderIterator = false

  // Validate the secret key
  if (!validateSecretKey(receivedSecretKey)) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'unauthorized' })).setMimeType(ContentService.MimeType.JSON);
  }
    
  // Checks if a continuation token exists and finds the file or folder GDrive iterator if so
  if (payload.continuationToken) {
    fileOrFolderIterator = getFileOrFolderIterator(payload)
  }

  try {
    let fromFolder = DriveApp.getFolderById(fromFolderId);
    let toFolder = DriveApp.getFolderById(toFolderId);

    processFilesAndFolders(fromFolder, toFolder, fileOrFolderIterator);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
  
  } catch (err) {
      console.error(err.message);
      console.error(err.stack);
      storeErrorParams(e);
      throw new Error (err.message)
  }
}

function storeParams(params) {
  const userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty("debugParams", JSON.stringify(params));
}

function debugScript() {
  const userProperties = PropertiesService.getUserProperties();
  let params = userProperties.getProperty("debugParams");
  params = JSON.parse(params);
  doPost(params)
}

//Debugging functions. Useful if something goes wrong and you want to trace through the code.
//==========================================================================================

function storeErrorParams(params) {
  const userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty("errorParams", JSON.stringify(params));
}

function debugLastError() {
  const userProperties = PropertiesService.getUserProperties();
  let params = userProperties.getProperty("errorParams");
  params = JSON.parse(params);
  doPost(params)

}

function resumeTimedOutOperationsDebug(e) {
  try {
    // Delete the trigger that called the function
    if (e) {
      identifyAndDeleteTrigger(e);
    }

    // Check if the continue script flag is set and if it's false, does not run the rest of the code
    if (!continueScript()) {
      return;
    }

        const payload = {"Get your continuation payload JSON string from the execution log.};

        if (canDispatchTask()) {
          // Delete property before continuing to ensure that other scripts don't work on the same continuation token
          //scriptProperties.deleteProperty(key);

          //Once we know that the script property containing the continuation token that is currently being iterated upon, we can safely release the lock to allow for concurrency.          
          taskCompleted();
          //releaseLock(lock)
          
          //Resume copy process
          resume(payload);
          
        } else {
          saveAndReschedule(payload, false);
          taskCompleted();
          releaseLock()
          console.log("Too many processes running. Rescheduling.");
        }


      
    

  } catch (err) {
    console.error("Error: " + err.message + "\n" + err.stack);
  }

}

function listFoldersInFolderIterator(folderIterator) {
  while (folderIterator.hasNext()) {
    console.log(folderIterator.next().getName())
  }
}

//Helper functions
//========================

function processFiles(fromFolder, toFolder, fileOrFolderIterator) {
  let files; 
  if (!fileOrFolderIterator) {
    files = fromFolder.getFiles();    
  } else {
    files = fileOrFolderIterator.iterator;    
    
  }
  //ProcessFileIterator returns true or false depending on whether it's completed or whether it's been scheduled for another time.
  let outcome = processFileIterator(files, toFolder);

  return outcome;  
}

function processFolders(fromFolder, toFolder, fileOrFolderIterator) {
  let folders;

  //If fromFolder is false, that means that we're working from an interator generated from a continuation token. It it isn't false, we've got a full folder to iterate through.

  if (fromFolder !== false) {
    folders = fromFolder.getFolders();    
  } else {    
    folders = fileOrFolderIterator.iterator;
  }
  
  let outcome = processFolderIterator(folders, toFolder);

  return outcome;
}

function processFileIterator(files, toFolder) {
  while (files.hasNext()) {
    let file = files.next();
    let filename = file.getName() //Assign filename to a variable to reduce API calls.
    if (!doesFileExist(toFolder, filename)) {
      const newFile = file.makeCopy(toFolder);
      newFile.setName(filename);
      console.log(filename + " copied successfully");
    } else {
      console.log(filename + " exists. Skipping.");      }

    if (isNearTimeout()) {
      let continuationToken = files.getContinuationToken();
      let continuationPayload = {
              "continuationToken": continuationToken, 
              "type": "files",
              "toFolderId" : toFolder.getId()
              }
      
      saveAndReschedule(continuationPayload);
      return false;
    }
  }
   return true;
}

function processFolderIterator(folders, toFolder) {

  while (folders.hasNext()) {
    //Declare continuation paylod variable for use later.
    let continuationPayload;
    let continuationToken;

    //Iterate through the folders iterator and copy the contents.
    const folder = folders.next();
    let folderName = folder.getName(); //Reduce API calls.
    console.log(folderName);
    let newFolder = findExistingFolder(toFolder, folderName);
    if (!newFolder) {
      newFolder = toFolder.createFolder(folderName);
    } else {
      console.log(folderName + " exists. Skipping");
    }

    if (isNearTimeout()) {
      continuationToken = folders.getContinuationToken();
      continuationPayload = {
              "continuationToken": continuationToken, 
              "type": "folder",
              "toFolderId" : toFolder.getId()
              } 
      saveAndReschedule(continuationPayload);
      return false;
    }

    let newPayload = {
      fromFolderId: folder.getId(),
      toFolderId: newFolder.getId(),
      secretKey: SECRET_KEY
    };

    if (canDispatchTask()) {
      console.log("Beginning recursion")
      callWorkerWebApp(newPayload);
      taskCompleted();
    } else {
      continuationToken = folders.getContinuationToken();
      continuationPayload = {
              "continuationToken": continuationToken, 
              "type": "folder",
              "toFolderId" : newFolder.getId()
              }  

      saveAndReschedule(continuationPayload);
      return false;
    }
  }
    return true; 
}


function processFilesAndFolders(fromFolder, toFolder, fileOrFolderIterator) {
  let filesCompleted = false;
  let foldersCompleted = false;
  

  //Checks the iterator type and continues accordingly.

  //If it's a file iterator, the copy operation continues from where the last one timed out.  
  if (fileOrFolderIterator.type == "files") {
    console.log("Resumng the copying of files");
    //Gets the from folder using the .getParents method from the filesIterator. If you don't do this, you get crashes when you attempt to resume copying folders.
    fromFolder = fileOrFolderIterator.iterator.next().getParents();
    fromFolder = fromFolder.next()
    console.log(fromFolder.getName())
    filesCompleted = processFiles(false, toFolder, fileOrFolderIterator);

  //If all files have been processed, process the folders. Ensuring all the files have been processed first avoids creating duplicate folders.
  if (filesCompleted) {
    
    foldersCompleted = processFolders(fromFolder, toFolder, fileOrFolderIterator);
    }
  // If it's a folder iterator, the copy operation continues from where the last one timed out.
  } else if (fileOrFolderIterator.type == "folder") {
    console.log("Resuming the copying of folders.");
    foldersCompleted = processFolders(fromFolder, toFolder, fileOrFolderIterator);
  }

  // If it's none of the above, assume that we're starting the process and there's no continuation tokens yet.
  else {
    filesCompleted = processFiles(fromFolder, toFolder, false);
    

    //If all files have been processed, process the folders. Ensuring all the files have been processed first avoids creating duplicate folders.
    if (filesCompleted) {
      console.log("All files in the current folder copied.")
      foldersCompleted = processFolders(fromFolder, toFolder, false);
    }
  }
}

//Utility Functions
//=================

function doesFileExist(folder, fileName) {
  const files = folder.getFilesByName(fileName);
  return files.hasNext();
}

function findExistingFolder(folder, folderName) {
  const folders = folder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return null;
}

function getFileOrFolderIterator(payload) {
  if (payload.type == "files") {
    let filesIterator = DriveApp.continueFileIterator(payload.continuationToken)
    return {"type": "files", "iterator": filesIterator};
  } else if (payload.type =="folder") {
    let foldersIterator = DriveApp.continueFolderIterator(payload.continuationToken);
    return {"type" : "folder", "iterator": foldersIterator};
  } else {
    return "Unknown Type";
  }
}



function callWorkerWebApp(payload) {
  let scriptProperties = PropertiesService.getScriptProperties();
  let url = scriptProperties.getProperty("workerUrl");
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };
  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    console.error('Exception during fetch:', e);
    //Retry with exponential backoff.
    saveAndReschedule(payload, false)
  }
  return;
}

function validateSecretKey(receivedKey) {
  const storedKey = PropertiesService.getScriptProperties().getProperty('secretKey');
  if (receivedKey !== storedKey) {
    console.error("Unauthorised. Key sent is: " + receivedKey + "\n Stored Key is: " + storedKey);
    return false;
  } else {
    return true;
  }
}



function getSecretKey() {
  //Checks if a secret key has already been generated and returns it if so.
  const scriptProperties = PropertiesService.getScriptProperties();
  let secretKey = scriptProperties.getProperty('secretKey');

  if (secretKey) {
    return secretKey;

  // If a secret key hasn't been generated, it will generate one now.
  } else {
    const length = 256;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      secretKey += charset[randomIndex];
    }
    scriptProperties.setProperty('secretKey', secretKey);

    return secretKey();
  }


}

function resetRetries() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('retries', 0)
}

function clearResumeProperties() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const properties = scriptProperties.getProperties();
  for (let key in properties) {
    if (key.startsWith('resume_')) {
      scriptProperties.deleteProperty(key)
    }
  }
}

function enableRunningOfChildFunctions() {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty("continueRunning", true);
}

function continueScript() {
  const properties = PropertiesService.getScriptProperties();  
  return JSON.parse(properties.getProperty("continueRunning"));

}

//This is necessary because otherwise it's very difficult to kill off all instances of the script once it gets going.

function stopScript() {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty("continueRunning", false)

  clearAllTriggers();
  clearResumeProperties();

}

//Timeout Handling functions
//==========================

function isNearTimeout() {
  //Check if we're getting close to the execution time limit
  if (new Date().getTime() - START_TIME > MAX_EXECUTION_TIME) {  
    return true;
  } else {
    return false;
  }
}


function scheduleResume() {
  const scriptProperties = PropertiesService.getScriptProperties();
  let retries = Number(scriptProperties.getProperty('retries')) || 0;
  
  //Limit retries figure to 7 so that the exponential backoff doesn't become too ridiculous.
  if (retries < 7) {
    retries += 0.5;
  } 
   
  scriptProperties.setProperty('retries', String(retries));

  //Checks if there are too many triggers and only creates a new one if there are under 10.

  if (checkTriggersCount()) {
    ScriptApp.newTrigger('resumeTimedOutOperations')
    .timeBased()
    .after(1000 * Math.pow(2, retries)) // Exponential backoff
    .create();

  }



  //Sets scheduled variable to true so that the same instance of the script isn't scheduled twice.  
  SCHEDULED = true
}

function saveAndReschedule(payload) {
  const scriptProperties = PropertiesService.getScriptProperties();
  

  //Creates a key from the continuation token. This is stored in ScriptProperties and when the function is triggered from schedule, it will iterate through each continuation key until there are none left.
  payload = JSON.stringify(payload)
  const resumeKey = 'resume_' + payload;
  scriptProperties.setProperty(resumeKey, payload);

  //Checks if this instance of the script has already been scheduled and if there are fewer than 20 scheduled triggers already.
  if (!SCHEDULED) {
    scheduleResume()
  }
  return;
}


//Resuming from triggers functions
//================================

function resumeTimedOutOperations(e) {
  try {
    // Delete the trigger that called the function
    if (e) {
      identifyAndDeleteTrigger(e);
    }

    // Check if the continue script flag is set and if it's false, does not run the rest of the code
    if (!continueScript()) {
      return;
    }

    const scriptProperties = PropertiesService.getScriptProperties();
    const properties = scriptProperties.getProperties();

    for (let key in properties) {
      // Try to acquire the lock
      let lock = getLock();

      if (lock == null) {
        scheduleResume()
        console.log("Rescheduling task. Unable to get lock.")
        releaseLock(lock);
        return;
      }

      if (key.startsWith('resume_')) {
        console.log("Current continuation token being worked on is: " + properties[key]);
        const payload = JSON.parse(properties[key]);

        if (canDispatchTask()) {
          // Delete property before continuing to ensure that other scripts don't work on the same continuation token
          scriptProperties.deleteProperty(key);

          //Once we know that the script property containing the continuation token that is currently being iterated upon, we can safely release the lock to allow for concurrency.          
          taskCompleted();
          releaseLock(lock)
          
          //Resume copy process
          resume(payload);
          
        } else {
          taskCompleted();
          releaseLock()
          console.log("Too many processes running. Rescheduling.");
        }


      }
    }

  } catch (err) {
    console.error("Error: " + err.message + "\n" + err.stack);
  }

}

function resume(payload) {
  let fileOrFolderIterator = false;
  let fromFolder = false;
  let fromFolderId;
  let toFolderId = payload.toFolderId

  // Assign value to optional variables if they're present
  if (payload.continuationToken) {
    fileOrFolderIterator = getFileOrFolderIterator(payload);
  }

  if (payload.fromFolderId) {
    fromFolderId = payload.fromFolderId;
    fromFolder = DriveApp.getFolderById(fromFolderId);
  }

  processFilesAndFolders(fromFolder, DriveApp.getFolderById(toFolderId), fileOrFolderIterator);
}

//Trigger management functions
//============================

function identifyAndDeleteTrigger(event) {
  // Get the trigger ID
  var triggerId = event.triggerUid;

  // Perform your function tasks here
  console.log("Function called by trigger: " + triggerId);

  // Delete the trigger after it's called
  deleteTriggerById(triggerId);
}

function deleteTriggerById(triggerId) {
  // Get all triggers for this project
  var allTriggers = ScriptApp.getProjectTriggers();

  // Loop through the triggers and delete the one with the matching ID
  for (var i = 0; i < allTriggers.length; i++) {
    if (allTriggers[i].getUniqueId() === triggerId) {
      ScriptApp.deleteTrigger(allTriggers[i]);
      console.log("Deleted trigger with ID: " + triggerId);
      break;
    }
  }
}

function clearAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  console.log('All triggers cleared.');
}

function clearAllWorkerTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'resumeTimedOutOperations' || triggers[i].getHandlerFunction() === 'initiateCopy') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  console.log('All worker-related triggers cleared.');
}

function checkTriggersCount() {
  var triggers = ScriptApp.getProjectTriggers();
  var triggersCount = triggers.length;

  if (triggersCount < 15) {
    return true;
  } else {
    return false;
  }
}

//Concurrency management functions
//=================================

function getLock() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);  // Wait 10 seconds for a lock
    return lock;
  } catch (e) {
    console.error("Could not obtain lock", e);
    return null;
  }
}

function releaseLock(lock) {
  if (lock) {
    try {
      lock.releaseLock();
    } catch (e) {
      console.error("Could not release lock", e);
    }
  }
}

function canDispatchTask() {
  const properties = PropertiesService.getScriptProperties();
  const activeTasks = Number(properties.getProperty('activeTasks')) || 0;

  if (activeTasks < 30) {
    properties.setProperty('activeTasks', activeTasks + 1);
    //releaseLock(lock);
    return true;
  } else {
    console.log("Too many active tasks: " + activeTasks);
    return false;
  }
}

function taskCompleted() {
  const properties = PropertiesService.getScriptProperties();
  const activeTasks = Number(properties.getProperty('activeTasks')) || 0;
  properties.setProperty('activeTasks', Math.max(activeTasks - 1, 0));

}

function resetActiveTasks() {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('activeTasks', 0);

}


