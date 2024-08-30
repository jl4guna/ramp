#!/usr/bin/env node

import { program } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GeneratedView {
  model: string;
  viewType: string;
  hash: string;
}

interface MigrationManifest {
  version: string;
  generatedViews: GeneratedView[];
}

interface Relation {
  name: string;
  type: 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';
  relatedModel: string;
}

interface Field {
  name: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
  isUnique: boolean;
  default?: string;
  relation?: Relation;
}

interface Model {
  name: string;
  fields: Field[];
}

async function findPrismaSchema(startDir: string): Promise<string | null> {
  let currentDir = startDir;
  while (currentDir !== path.parse(currentDir).root) {
    const schemaPath = path.join(currentDir, 'prisma', 'schema.prisma');
    try {
      await fs.access(schemaPath);
      return schemaPath;
    } catch {
      currentDir = path.dirname(currentDir);
    }
  }
  return null;
}

async function parsePrismaSchema(schemaPath: string): Promise<Model[]> {
  try {
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    const models: Model[] = [];
    let currentModel: Model | null = null;

    const lines = schemaContent.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('model')) {
        if (currentModel) {
          models.push(currentModel);
        }
        const modelName = trimmedLine.split(' ')[1];
        currentModel = { name: modelName, fields: [] };
      } else if (currentModel && trimmedLine.includes('{')) {
        // Start of the model block, we don't need to do anything here
      } else if (currentModel && trimmedLine === '}') {
        models.push(currentModel);
        currentModel = null;
      } else if (currentModel && trimmedLine) {
        // Parse field
        const [name, type, ...modifiers] = trimmedLine.split(/\s+/);
        const field: Field = {
          name,
          type: type.replace(/[?[\]]/, ''),
          isRequired: !type.includes('?'),
          isList: type.includes('[]'),
          isUnique: modifiers.includes('@unique'),
        };

        if (modifiers.includes('@default')) {
          const defaultValue = modifiers
            .find((m) => m.startsWith('@default'))
            ?.match(/\((.*?)\)/)?.[1];
          if (defaultValue) {
            field.default = defaultValue;
          }
        }

        // Relationship handling
        if (type.includes('@relation')) {
          const relationInfo = modifiers
            .find((m) => m.startsWith('@relation'))
            ?.match(/\((.*?)\)/)?.[1];
          if (relationInfo) {
            const [relatedModel, fieldsMappings] = relationInfo
              .split(',')
              .map((s) => s.trim());
            const relationType = determineRelationType(field, fieldsMappings);
            field.relation = {
              name: relatedModel,
              type: relationType,
              relatedModel: type.replace('[]', ''),
            };
          }
        }

        currentModel.fields.push(field);
      }
    }

    return models;
  } catch (error) {
    console.error('Error reading Prisma schema:', error);
    process.exit(1);
  }
}

function determineRelationType(
  field: Field,
  fieldsMappings?: string
): Relation['type'] {
  if (field.isList) {
    return fieldsMappings?.includes('references') ? 'oneToMany' : 'manyToMany';
  } else {
    return fieldsMappings?.includes('references') ? 'manyToOne' : 'oneToOne';
  }
}

async function findRemixAppDir(startDir: string): Promise<string | null> {
  let currentDir = startDir;
  while (currentDir !== path.parse(currentDir).root) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    try {
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, 'utf-8')
      );
      if (
        packageJson.dependencies &&
        packageJson.dependencies['@remix-run/react']
      ) {
        return path.join(currentDir, 'app');
      }
    } catch {}
    currentDir = path.dirname(currentDir);
  }
  return null;
}

async function generateViews(
  models: Model[],
  outputDir: string,
  templatesDir: string,
  manifest: MigrationManifest
) {
  const newManifest: MigrationManifest = {
    version: manifest.version,
    generatedViews: [],
  };

  for (const model of models) {
    const viewTypes = ['List', 'Create', 'Update', 'Delete', 'Search'];

    for (const viewType of viewTypes) {
      const templatePath = path.join(templatesDir, `${viewType}.hbs`);
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const template = Handlebars.compile(templateContent);
      const renderedView = template({ model });

      const modelOutputDir = path.join(
        outputDir,
        'routes',
        model.name.toLowerCase()
      );
      await fs.mkdir(modelOutputDir, { recursive: true });

      const viewPath = path.join(
        modelOutputDir,
        `${viewType.toLowerCase()}.tsx`
      );
      const newHash = crypto
        .createHash('md5')
        .update(renderedView)
        .digest('hex');

      const existingView = manifest.generatedViews.find(
        (v) => v.model === model.name && v.viewType === viewType
      );

      if (!existingView || existingView.hash !== newHash) {
        await fs.writeFile(viewPath, renderedView);
        console.log(`Vista ${model.name}${viewType} actualizada.`);
      } else {
        console.log(`Vista ${model.name}${viewType} sin cambios.`);
      }

      newManifest.generatedViews.push({
        model: model.name,
        viewType,
        hash: newHash,
      });
    }
  }

  return newManifest;
}
async function loadManifest(outputDir: string): Promise<MigrationManifest> {
  const manifestPath = path.join(outputDir, '.ramp-manifest.json');
  try {
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(manifestContent);
  } catch (error) {
    return {
      version: '1.0.0',
      generatedViews: [],
    };
  }
}

async function saveManifest(outputDir: string, manifest: MigrationManifest) {
  const manifestPath = path.join(outputDir, '.ramp-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

program
  .version('1.0.0')
  .description('CLI to generate a admin panel for Remix.run');

program
  .command('generate')
  .description('Generates or updates admin views based on the Prisma schema')
  .option('-s, --schema <path>', 'Prisma schema file path (optional)')
  .option(
    '-o, --output <directory>',
    'Output directory for the generated views (optional)'
  )
  .option('-t, --templates <directory>', 'EJS templates directory (optional)')
  .action(async (options) => {
    const currentDir = process.cwd();

    const schemaPath = options.schema || (await findPrismaSchema(currentDir));
    if (!schemaPath) {
      console.error(
        'Could not find the schema.prisma file. Make sure you are in a Remix project with Prisma.'
      );
      process.exit(1);
    }

    const remixAppDir = await findRemixAppDir(currentDir);
    if (!remixAppDir) {
      console.error(
        'Could not find the Remix app directory. Make sure you are in a Remix project.'
      );
      process.exit(1);
    }

    const outputDir = options.output || remixAppDir;
    const templatesDir = options.templates || path.join(__dirname, 'templates');

    const manifest = await loadManifest(outputDir);
    const models = await parsePrismaSchema(schemaPath);
    const newManifest = await generateViews(
      models,
      outputDir,
      templatesDir,
      manifest
    );
    await saveManifest(outputDir, newManifest);

    console.log('Generation/update process completed.');
  });

program.parse(process.argv);
