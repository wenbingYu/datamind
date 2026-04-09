/**
 * Fix vocabulary lemma column:
 * - Parse abbreviation entries like "AI (=artificial intelligence)" → lemma "ai"
 * - Strip punctuation/symbols from word entries (abandon** → abandon)
 * - Handle slash alternatives (actor/actress → actor)
 * - Re-lemmatize all words
 */
const { getDatabase } = require('../dist/core/engine/duckdb');
const { lemmatize, cleanVocabEntry, parseVocabAbbreviation } = require('../dist/core/nlp/lemmatizer');

async function main() {
  const db = await getDatabase();

  // Get all vocabulary rows
  const rows = await db.all(`SELECT "id", "word" FROM "vocabulary"`);
  console.log(`Total vocabulary entries: ${rows.length}`);

  let abbrCount = 0;
  let cleanedCount = 0;
  let updateCount = 0;

  for (const row of rows) {
    const word = row.word;

    // cleanVocabEntry handles abbreviations, variants, compound nouns, punctuation
    const cleanedWords = cleanVocabEntry(word);
    const primaryWord = cleanedWords[0] || word;

    let newLemma;

    // Check if it's an abbreviation
    const abbrLemma = parseVocabAbbreviation(word);
    if (abbrLemma) {
      newLemma = abbrLemma;
      abbrCount++;
    } else if (primaryWord.includes(' ')) {
      // Multi-word phrase (compound noun): use as-is, don't lemmatize
      newLemma = primaryWord;
      cleanedCount++;
    } else {
      // Single word: apply lemmatize to the cleaned word
      newLemma = lemmatize(primaryWord);
      if (newLemma !== word.toLowerCase()) cleanedCount++;
    }

    // Update the lemma
    await db.run(
      `UPDATE "vocabulary" SET "lemma" = ? WHERE "id" = ?`,
      newLemma,
      row.id
    );
    updateCount++;
  }

  console.log(`Updated ${updateCount} entries`);
  console.log(`  ${abbrCount} abbreviation entries`);
  console.log(`  ${cleanedCount} entries with cleaned lemma`);

  // Show examples
  const examples = await db.all(`SELECT "word", "lemma" FROM "vocabulary" WHERE "word" LIKE '%*%' LIMIT 10`);
  console.log('\nStar-marked entries:');
  examples.forEach(e => console.log(`  ${e.word} → lemma: ${e.lemma}`));

  const slashEx = await db.all(`SELECT "word", "lemma" FROM "vocabulary" WHERE "word" LIKE '%/%' LIMIT 10`);
  console.log('\nSlash entries:');
  slashEx.forEach(e => console.log(`  ${e.word} → lemma: ${e.lemma}`));

  const dotEx = await db.all(`SELECT "word", "lemma" FROM "vocabulary" WHERE "word" LIKE '%.%' LIMIT 10`);
  console.log('\nDot entries:');
  dotEx.forEach(e => console.log(`  ${e.word} → lemma: ${e.lemma}`));

  // Check remaining dirty lemmas
  const dirty = await db.all(`SELECT CAST(COUNT(*) AS INTEGER) as c FROM "vocabulary" WHERE "lemma" LIKE '%*%' OR "lemma" LIKE '%.%'`);
  console.log(`\nRemaining lemmas with punctuation: ${dirty[0].c}`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
