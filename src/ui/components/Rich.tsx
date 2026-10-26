/**
 * A text from the language files with words set in bold: `**x**` becomes `<strong>x</strong>`.
 * The marks stay in the text of every language, so each can put the bold words where it wants.
 */
export function Rich({ text }: { readonly text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/).map((part, index) =>
        // The odd parts are the ones between the marks.
        index % 2 === 1 ? <strong key={`${index}-${part}`}>{part}</strong> : part,
      )}
    </>
  );
}
