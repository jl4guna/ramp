# Remix Admin Panel CLI (RAMP)

RAMP is a Command Line Interface tool designed to automatically generate and manage admin panel views for Remix.run applications using Prisma as an ORM.

## Features

- Automatic generation of CRUD views based on your Prisma schema
- Smart view updates: only regenerates views that have changed
- Customizable EJS templates for view generation
- Built-in migration system to track and update generated views

## Installation - Not yet available

To install RAMP globally, run:

```bash
npm install -g ramp
```

## Usage

Navigate to your Remix.run project directory and run:

```bash
ramp generate
```

This command will:

1. Locate your Prisma schema file
2. Parse the schema and extract model information
3. Generate or update admin views in your Remix app's `routes` directory
4. Create or update a manifest file to track generated views

### Options

- `-s, --schema <path>`: Specify the path to your Prisma schema file (optional)
- `-o, --output <directory>`: Specify the output directory for generated views (optional)
- `-t, --templates <directory>`: Specify a custom directory for EJS templates (optional)

Example with options:

```bash
ramp generate -s ./prisma/schema.prisma -o ./app/routes/admin -t ./my-templates
```

## Customizing Templates

RAMP uses EJS templates to generate views. You can customize these templates to fit your project's needs:

1. Create a new directory for your custom templates
2. Copy the default templates from the RAMP package to your new directory
3. Modify the templates as needed
4. Use the `-t` option to specify your custom templates directory when running RAMP

## Migration System

RAMP includes a built-in migration system to handle updates to your Prisma schema:

- It tracks generated views using a manifest file (`.ramp-manifest.json`)
- When regenerating views, it only updates those that have changed
- This system helps preserve any manual customizations you've made to generated views

## Contributing

We welcome contributions to RAMP! Here's how you can help:

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Make your changes and write tests if applicable
4. Submit a pull request with a clear description of your changes

Please ensure your code adheres to the existing style and passes all tests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please file an issue on the GitHub repository.

## Roadmap

- [ ] Add a `diff` command to show changes before applying updates
- [ ] Implement a backup system for existing views
- [ ] Add support for custom migrations
- [ ] Develop a conflict resolution system for manually modified views

We're always looking to improve RAMP. If you have ideas for new features, please let us know by creating an issue!