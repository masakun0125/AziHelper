const supabase = require('./supabase');

module.exports = async function checkAdmin(discordId) {

  const { data, error } = await supabase
    .from('admins')
    .select('discord_id, role')
    .eq('discord_id', discordId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
};
