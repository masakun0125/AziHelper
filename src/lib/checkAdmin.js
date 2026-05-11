const supabase = require('./supabase');

async function checkAdmin(discordId) {
  const { data, error } = await supabase
    .from('admins')
    .select('discord_id')
    .eq('discord_id', discordId)
    .single();

  if (error || !data) return false;
  return true;
}

module.exports = checkAdmin;
