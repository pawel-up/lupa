import { executeCommand } from './execute_command.js'

/**
 * Options for setting files on an intercepted file chooser dialog.
 *
 * @use-when
 * Use when specifying upload options such as timeout or noWaitAfter on a FileChooser instance.
 *
 * @dont-use-when
 * Do not use for locator-level setInputFiles operations.
 */
export interface FileChooserSetFilesOptions {
  /**
   * Actions that initiate navigations are waiting for the navigation to finish and to return its result.
   */
  noWaitAfter?: boolean

  /**
   * Maximum time in milliseconds. Defaults to 30000.
   */
  timeout?: number
}

/**
 * Represents a file chooser dialog that was opened in the browser.
 *
 * @use-when
 * Use when a user action (like clicking a custom-styled upload button) triggers a native file chooser dialog.
 *
 * @dont-use-when
 * Do not use if the `<input type="file">` element is accessible directly. In those cases, use
 * `locator.setInputFiles()` instead.
 */
export class FileChooser {
  /**
   * Creates an instance of FileChooser.
   *
   * @param id - The unique identifier of the file chooser tracked on the runner.
   * @param isMultiple - Whether the file chooser accepts multiple files.
   */
  constructor(
    public readonly id: string,
    public readonly isMultiple: boolean
  ) {}

  /**
   * Sets the files to upload on this file chooser.
   *
   * @example
   * ```typescript
   * await fc.setFiles('package.json')
   * ```
   *
   * @param files - A file path or array of file paths.
   * @param options - Optional settings.
   * @returns A promise that resolves when the files are set.
   */
  async setFiles(files: string | string[], options?: FileChooserSetFilesOptions): Promise<void> {
    await executeCommand('fileChooser:setFiles', {
      id: this.id,
      files,
      options,
    })
  }
}

/**
 * Service to intercept and manage native file chooser dialogs.
 *
 * @use-when
 * Use to intercept native file dialogs before triggering the action that opens them.
 *
 * @dont-use-when
 * Do not use for standard input interactions that don't trigger native OS file upload dialogs.
 */
class FileChooserService {
  /**
   * Waits for a file chooser to open. This should be run concurrently with the trigger action.
   *
   * @example
   * ```typescript
   * import { fileChooser, query } from '@pawel-up/lupa/commands'
   *
   * const [fc] = await Promise.all([
   *   fileChooser.waitForEvent(),
   *   query({ text: 'Upload' }).click(),
   * ])
   *
   * await fc.setFiles('myfile.png')
   * ```
   *
   * @param options - Optional timeout configuration.
   * @returns A promise that resolves to a FileChooser instance.
   */
  async waitForEvent(options?: { timeout?: number }): Promise<FileChooser> {
    const result = await executeCommand<{ id: string; isMultiple: boolean }>('fileChooser:waitForEvent', options)
    return new FileChooser(result.id, result.isMultiple)
  }
}

export const fileChooser = new FileChooserService()
