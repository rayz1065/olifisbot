import fs from 'fs';
import path from 'path';

const SOLUTIONS_DIR = 'jpgsoluzione';
const QUESTIONS_DIR = 'jpgtesto';
const SKIPPED_FILENAMES = ['z_costanti.jpg', 'pagine'];

async function renameYear(year: string, directory: string) {
  const solutionsDir = path.join(directory, SOLUTIONS_DIR);
  const questionsDir = path.join(directory, QUESTIONS_DIR);
  const solutionFiles = (await fs.promises.readdir(solutionsDir)).filter(
    (filename) => {
      if (!filename.startsWith('r_') || !filename.endsWith('.jpg')) {
        if (SKIPPED_FILENAMES.indexOf(filename) === -1) {
          console.warn('Unrecognized file', filename);
        }
        return false;
      }
      return true;
    }
  );
  const questionFiles = (await fs.promises.readdir(questionsDir)).filter(
    (filename) => {
      if (!filename.startsWith('q_') || !filename.endsWith('.jpg')) {
        if (SKIPPED_FILENAMES.indexOf(filename) === -1) {
          console.warn('Unrecognized file', filename);
        }
        return false;
      }
      return true;
    }
  );
  const outputDir = path.join(
    __dirname,
    '..',
    '..',
    'storage',
    'questions',
    'first-level',
    `${year}`,
    'default'
  );
  if (fs.existsSync(outputDir)) {
    console.error(outputDir, 'already exists');
    return;
  }
  await fs.promises.mkdir(outputDir, { recursive: true });
  for (const file of questionFiles) {
    const oldPath = path.join(questionsDir, file);
    const newPath = path.join(
      outputDir,
      file.replace('_0', '_').replace('q_', 'q-')
    );
    await fs.promises.copyFile(oldPath, newPath);
  }
  for (const file of solutionFiles) {
    const oldPath = path.join(solutionsDir, file);
    const newPath = path.join(
      outputDir,
      file.replace('_0', '_').replace('r_', 'a-')
    );
    await fs.promises.copyFile(oldPath, newPath);
  }
}

async function renameFiles() {
  const oldQuestionsDir = path.join(
    __dirname,
    '..',
    '..',
    'storage',
    'old-questions'
  );
  const dirs = await fs.promises.readdir(oldQuestionsDir);
  for (const dir of dirs) {
    await renameYear(dir, path.join(oldQuestionsDir, dir));
  }
  console.log('done');
}

void renameFiles();
