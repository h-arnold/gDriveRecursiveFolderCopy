## 
# Google Drive Parallel Recursive Folder Copier

Google will not allow you to copy folders via the WebUI and it will not allow you to transfer ownership of folders to people outside of your organisation. This can be a problem if you want to migrate from one Workspace org to another. This script addresses this problem by recursively copying the source folder to the destination folder of the users' choosing. The running the script needs to have at least view access of the source folder and edit access of the destination folder. 

The other implementations of this solution copy files sequentially and are subject to the Google App Script execution limits. Because the app script copy operation is so slow (~0.5sec/file) this limits size and complexity of folders you can copy significantly. To overcome this, I made my own version which  copies files and folders in parallel (up to 30 simulatenous workers) and automatically schedules the resumption of copy operations before the 6 minute execution limit is hit. This means that you can copy large and complex folder strucutres relatively quickly (it's still painfully slow), subject to the maximum 6 hours of cumulative exection time time per day limit.

## Features

- **Transfer Ownership**: The copied folders and files will belong to the user who runs the script, making it ideal for transferring data between organisations.
- **Parallel Execution**: Capable of executing up to 30 copy operations in parallel.
- **Resumable Operations**: Automatically handles timeouts and can resume operations from where they left off.

## Getting Started

### Prerequisites

- A Google account with access to both the source and destination folders on Google Drive.
- Google Apps Script access (typically available with Google Workspace accounts).

### Installation

1. **Clone the Repository**:
    ```sh
    git clone https://github.com/h-arnold/gDriveRecursiveFolderCopy.git
    ```
2. **Set Up the Script**:
    - Open [Google Apps Script](https://script.google.com/) and create a new project.
    - Copy the contents of the script file from the repository into the new project.

3. **Configure the Script**:
    - Set the `fromFolderId` and `toFolderId` variables with the respective folder IDs in the `startCopy()` function.
    - Deploy the script as a web app (select "Deploy" > "New deployment" > "Web app" and set access to 'anyone' and excute by 'me {your email address}'. Copy the WebApp URL
    - Go to options and create a script property called workerUrl.
    - Paste the Web App URL into the 'value' box of the workerUrl script property.
### Usage

 **Start the Copy Process**:
 
  - Run the ```startCopy()``` function from the script editor to initiate the copying process.
  - Wait patiently. Large folders could take hours.
  - ***Note***: The initial copy process may start slowly, especially if there are many files in the root folder as files are copied sequentially before recursively copying folders. If copying appears to have stalled briefly be patient as a resumption script should have a trigger to start in the next minute or so. The speed will soon pick up when it starts recursively working its way through the folder tree.

 **Ending the copy process prematurely**:
   - Run the `stopScript` function to end the process. 
     - This clears all exisiting resumption triggers and sets the `continueRunning` script property to `false,` which means any future instances will end immediately.
   - Wait 5-10 minutes for all instances to stop running.
   - ***IMPORTANT***: Stopping the `startCopy()` function will not be sufficient to stop the copy process on its own because this script creates multiple child instances which create resumption triggers. If you stop the copy process deep into a copy, you may find it impossible to manually stop all child processes and triggers from being created.



### Debugging

The script includes several debugging functions:
- **storeParams(params)**: Stores parameters for debugging.
- **debugScript()**: Runs the script with stored debug parameters.
- **storeErrorParams(params)**: Stores error parameters for later debugging.
- **debugLastError()**: Runs the script with stored error parameters.

### Notes

- **Execution Time**: The script is designed to handle Google's execution time limits by scheduling and resuming tasks as needed.
- **Ownership Transfer**: All copied files and folders will be owned by the user who runs the script, ensuring proper transfer of data between organisations.
- **It's still slow**: Copy files and folders via Google App Script is painfully slow. This script just makes it slightly less painful.

## Contributing

Feel free to submit issues and pull requests to improve the script and add new features.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
